import './env';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearRoadCache, decodePolyline, ROAD_FACTOR, roadKm, roadLegs, roadRoute, waypointsAlong } from '../src/services/roadDistance.service';
import { haversineKm } from '../src/utils/helpers';

/* Distances are by the SHORTEST ROAD route (as a map app lists its alternatives), never a straight line. */
const A = { lat: 26.814162, lng: 75.773166 }; // warehouse
const B = { lat: 26.9, lng: 75.8 };
const C = { lat: 26.7, lng: 75.7 };

let urls: string[] = [];
let reply: (url: string) => Response = () => new Response('{}', { status: 200 });
beforeEach(() => {
  process.env.ROAD_DISTANCE_MODE = 'road';
  delete process.env.GOOGLE_DIRECTIONS_API_KEY;
  clearRoadCache();
  urls = [];
  mock.method(globalThis, 'fetch', async (url: unknown) => { urls.push(String(url)); return reply(String(url)); });
});
afterEach(() => { mock.restoreAll(); process.env.ROAD_DISTANCE_MODE = 'straight'; delete process.env.GOOGLE_DIRECTIONS_API_KEY; });

const osrm = (...metres: number[]) => () => new Response(JSON.stringify({ code: 'Ok', routes: metres.map((distance) => ({ distance, geometry: { coordinates: [[75.77, 26.81], [75.8, 26.9]] } })) }), { status: 200 });

test('the distance is the SHORTEST of the road routes, not the quickest', async () => {
  reply = osrm(20000, 17500, 21000); // the quickest road is 20 km; a shorter one is 17.5 km
  const legs = await roadLegs(A, [B]);
  assert.deepEqual(legs.map((l) => [l.km, l.road]), [[17.5, true]]);
  assert.match(urls[0], /\/route\/v1\/driving\/75\.773166,26\.814162;75\.8,26\.9\?/, 'longitude first');
  assert.match(urls[0], /alternatives=3/, 'asks for the other roads too');
});

test('each place gets its own road; the answers are remembered', async () => {
  reply = (url) => osrm(url.includes('75.8,26.9') ? 13256.6 : 17590)();
  const legs = await roadLegs(A, [B, C]);
  assert.deepEqual(legs.map((l) => l.km), [13.26, 17.59]);
  assert.equal(urls.length, 2);
  const first = await roadKm(A, B);
  const again = await roadKm({ lat: A.lat + 0.00001, lng: A.lng }, B); // ~1 m away: the same cache entry
  assert.equal(again, first);
  assert.equal(urls.length, 2, 'no new lookups');
  assert.ok(first > haversineKm(A.lat, A.lng, B.lat, B.lng), 'a road is longer than the straight line');
});

test('when the road service is down the estimate is the straight line plus a road allowance, and it recovers', async () => {
  reply = () => { throw new Error('network down'); };
  const legs = await roadLegs(A, [B]);
  const straight = haversineKm(A.lat, A.lng, B.lat, B.lng);
  assert.equal(legs[0].road, false);
  assert.equal(legs[0].km, Math.round(straight * ROAD_FACTOR * 100) / 100);
  const before = urls.length;
  await roadLegs(A, [B]);
  assert.equal(urls.length, before, 'no request during the short pause');
  clearRoadCache(); // the pause is over
  reply = osrm(13256.6);
  assert.equal((await roadLegs(A, [B]))[0].road, true);
});

test('an HTTP error or a place with no road falls back for that place only', async () => {
  reply = () => new Response('slow down', { status: 429 });
  assert.equal((await roadLegs(A, [B]))[0].road, false);
  clearRoadCache();
  reply = (url) => (url.includes('75.8,26.9') ? new Response(JSON.stringify({ code: 'NoRoute' }), { status: 200 }) : osrm(17590)());
  const legs = await roadLegs(A, [B, C]);
  assert.equal(legs[0].road, false, 'no road found to B');
  assert.deepEqual([legs[1].road, legs[1].km], [true, 17.59]);
});

test('roadRoute draws the SHORTEST road, as [lat, lng] points, and never a straight line', async () => {
  reply = () => new Response(JSON.stringify({ code: 'Ok', routes: [
    { distance: 20000, geometry: { coordinates: [[75.773, 26.814], [75.9, 26.95], [75.8, 26.9]] } },
    { distance: 17500, geometry: { coordinates: [[75.773, 26.814], [75.78, 26.85], [75.8, 26.9]] } },
  ] }), { status: 200 });
  const r = await roadRoute(A, B);
  assert.equal(r.km, 17.5);
  assert.deepEqual(r.points, [[26.814, 75.773], [26.85, 75.78], [26.9, 75.8]]);
  clearRoadCache();
  reply = () => { throw new Error('down'); };
  const down = await roadRoute(A, B);
  assert.equal(down.road, false);
  assert.equal(down.points, null);
});

test('with a Google Directions key the shortest of Google\'s own routes is used, and a refused key falls back to OSRM', async () => {
  process.env.GOOGLE_DIRECTIONS_API_KEY = 'server-key';
  // Polyline for (38.5,-120.2) (40.7,-120.95) (43.252,-126.453), the documented example.
  const poly = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  reply = () => new Response(JSON.stringify({ status: 'OK', routes: [
    { legs: [{ distance: { value: 20000 } }], overview_polyline: { points: poly } },
    { legs: [{ distance: { value: 16800 } }], overview_polyline: { points: poly } },
  ] }), { status: 200 });
  const r = await roadRoute(A, B);
  assert.equal(r.km, 16.8, 'the shortest of Google\'s routes');
  assert.match(urls[0], /^https:\/\/maps\.googleapis\.com\/maps\/api\/directions\/json\?/);
  assert.match(urls[0], /origin=26\.814162,75\.773166/);
  assert.match(urls[0], /destination=26\.9,75\.8/);
  assert.match(urls[0], /alternatives=true/);
  assert.match(urls[0], /key=server-key/);
  assert.equal(r.points?.length, 3);
  // The key is refused (e.g. restricted to websites): OSRM answers, and Google is not asked again for a while.
  clearRoadCache();
  urls = [];
  reply = (url) => (url.startsWith('https://maps.googleapis.com')
    ? new Response(JSON.stringify({ status: 'REQUEST_DENIED', error_message: 'referer restrictions' }), { status: 200 })
    : osrm(18000)());
  assert.equal((await roadLegs(A, [B]))[0].km, 18);
  const googleCalls = urls.filter((u) => u.startsWith('https://maps.googleapis.com')).length;
  assert.equal(googleCalls, 1);
  assert.equal((await roadLegs(A, [C]))[0].road, true);
  assert.equal(urls.filter((u) => u.startsWith('https://maps.googleapis.com')).length, 1, 'not asked again after a refusal');
});

test('waypointsAlong picks a few points along the road so a map app follows the same route', () => {
  const pts: [number, number][] = Array.from({ length: 11 }, (_, i) => [26 + i * 0.01, 75] as [number, number]);
  const w = waypointsAlong(pts, 3);
  assert.equal(w.length, 3);
  assert.deepEqual(w.map((p) => p.lat), [26.03, 26.05, 26.08], 'evenly spaced along the road');
  assert.deepEqual(waypointsAlong(pts.slice(0, 2), 3), [], 'a two-point road needs none');
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')[0], [38.5, -120.2]);
});
