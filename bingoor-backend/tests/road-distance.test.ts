import './env';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearRoadCache, ROAD_FACTOR, roadKm, roadLegs, roadRoute } from '../src/services/roadDistance.service';
import { haversineKm } from '../src/utils/helpers';

/* Distances are by ROAD (as a map app drives it), never a straight line. */
const A = { lat: 26.814162, lng: 75.773166 }; // warehouse
const B = { lat: 26.9, lng: 75.8 };
const C = { lat: 26.7, lng: 75.7 };

let urls: string[] = [];
let reply: () => Response = () => new Response('{}', { status: 200 });
beforeEach(() => {
  process.env.ROAD_DISTANCE_MODE = 'road';
  clearRoadCache();
  urls = [];
  mock.method(globalThis, 'fetch', async (url: unknown) => { urls.push(String(url)); return reply(); });
});
afterEach(() => { mock.restoreAll(); process.env.ROAD_DISTANCE_MODE = 'straight'; });

const table = (row: (number | null)[]) => () => new Response(JSON.stringify({ code: 'Ok', distances: [[0, ...row]] }), { status: 200 });

test('roadLegs asks for the real road distance once for many places, longitude first', async () => {
  reply = table([13256.6, 17590]);
  const legs = await roadLegs(A, [B, C]);
  assert.deepEqual(legs.map((l) => l.road), [true, true]);
  assert.equal(legs[0].km, 13.26);
  assert.equal(legs[1].km, 17.59);
  assert.equal(urls.length, 1, 'one request for both places');
  assert.match(urls[0], /\/table\/v1\/driving\/75\.773166,26\.814162;75\.8,26\.9;75\.7,26\.7\?/);
  assert.match(urls[0], /sources=0/);
  assert.match(urls[0], /annotations=distance/);
});

test('a road is longer than the straight line, and the answer is remembered', async () => {
  reply = table([13256.6]);
  const first = await roadKm(A, B);
  assert.ok(first > haversineKm(A.lat, A.lng, B.lat, B.lng), 'road km is more than the straight line');
  const again = await roadKm({ lat: A.lat + 0.00001, lng: A.lng }, B); // ~1 m away: same cache entry
  assert.equal(again, first);
  assert.equal(urls.length, 1, 'no second lookup for the same trip');
});

test('when the road service is down the estimate is the straight line plus a road allowance, and it is tried again next time', async () => {
  reply = () => { throw new Error('network down'); };
  const legs = await roadLegs(A, [B]);
  const straight = haversineKm(A.lat, A.lng, B.lat, B.lng);
  assert.equal(legs[0].road, false);
  assert.equal(legs[0].km, Math.round(straight * ROAD_FACTOR * 100) / 100);
  assert.ok(legs[0].km > straight);
  // It is not hammered while down, and recovers on the next try after a short pause.
  const before = urls.length;
  await roadLegs(A, [B]);
  assert.equal(urls.length, before, 'no request during the pause');
  clearRoadCache(); // the pause is over
  reply = table([13256.6]);
  assert.equal((await roadLegs(A, [B]))[0].road, true, 'recovers once the service is back');
});

test('an HTTP error or a place with no road falls back for that place only', async () => {
  reply = () => new Response('slow down', { status: 429 });
  assert.equal((await roadLegs(A, [B]))[0].road, false);
  clearRoadCache();
  reply = table([null, 17590]);
  const legs = await roadLegs(A, [B, C]);
  assert.equal(legs[0].road, false, 'no road found to B');
  assert.deepEqual([legs[1].road, legs[1].km], [true, 17.59]);
});

test('roadRoute gives the road distance and the road to draw, as [lat, lng] points', async () => {
  reply = () => new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 13256.6, geometry: { coordinates: [[75.773, 26.814], [75.78, 26.85], [75.8, 26.9]] } }] }), { status: 200 });
  const r = await roadRoute(A, B);
  assert.equal(r.km, 13.26);
  assert.equal(r.road, true);
  assert.deepEqual(r.points, [[26.814, 75.773], [26.85, 75.78], [26.9, 75.8]]);
  assert.match(urls[0], /\/route\/v1\/driving\/75\.773166,26\.814162;75\.8,26\.9\?/);
  assert.match(urls[0], /geometries=geojson/);
  // No road service: a distance estimate, and no line to draw (never a straight line).
  clearRoadCache();
  reply = () => { throw new Error('down'); };
  const down = await roadRoute(A, B);
  assert.equal(down.road, false);
  assert.equal(down.points, null);
});
