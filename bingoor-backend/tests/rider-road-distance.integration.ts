import './env';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { clearRoadCache } from '../src/services/roadDistance.service';
import { signAccessToken } from '../src/utils/jwt';
import { haversineKm } from '../src/utils/helpers';

/*
 * The rider's "km to the customer" is what a map app would drive from where the rider is now
 * (e.g. 20 km on the road), never the straight line (14.8 km).
 */
test('the rider gets the road km from their position to the customer, not the straight line', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const originalFetch = globalThis.fetch;
  process.env.ROAD_DISTANCE_MODE = 'road';
  clearRoadCache();
  try {
    const rider = await User.create({ name: 'Rider', phone: '9000000001', password: 'test-password', role: 'rider' });
    const customer = await User.create({ name: 'Cust', phone: '9000000002', password: 'test-password', role: 'customer' });
    const from = { lat: 26.85, lng: 75.80 }; // the rider now
    const to = { lat: 26.96, lng: 75.86 }; // the customer: about 14 km straight
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      if (!String(url).startsWith('https://router.project-osrm.org/')) return originalFetch(url, options);
      return new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 20000, geometry: { coordinates: [[75.8, 26.8], [75.9, 26.9]] } }] }), { status: 200 }); // the road is 20 km
    });
    const call = async (who: { _id: unknown; role: string }, q: string) => {
      const r = await originalFetch(`${base}/rider/road-distance?${q}`, { headers: { Authorization: `Bearer ${signAccessToken(String(who._id), who.role)}` } });
      return { status: r.status, body: (await r.json()) as any };
    };
    const q = `fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}`;

    const straight = haversineKm(from.lat, from.lng, to.lat, to.lng);
    assert.ok(straight > 13 && straight < 15.5, `straight line is about 14 km (${straight.toFixed(1)})`);
    const ok = await call(rider, q);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.km, 20, 'the road km, as the map app shows');
    assert.equal(ok.body.data.road, true);

    // The route the rider is sent on: the shortest road with a few points along it (for a map app to follow).
    const rt = await originalFetch(`${base}/rider/route?${q}`, { headers: { Authorization: `Bearer ${signAccessToken(String(rider._id), rider.role)}` } });
    const route = ((await rt.json()) as any).data;
    assert.equal(route.km, 20);
    assert.ok(Array.isArray(route.points) && route.points.length >= 2);
    assert.ok(Array.isArray(route.waypoints));
    assert.equal((await call(customer, q.replace('rider/road-distance', 'rider/route'))).status, 403);

    // Only riders; bad coordinates are refused.
    assert.equal((await call(customer, q)).status, 403);
    assert.equal((await call(rider, `fromLat=91&fromLng=75&toLat=26&toLng=75`)).status, 400);
    assert.equal((await call(rider, `fromLat=26&fromLng=75`)).status, 400);

    // Road service down: an estimate (never the plain straight line), flagged as such.
    clearRoadCache();
    mock.restoreAll();
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      if (!String(url).startsWith('https://router.project-osrm.org/')) return originalFetch(url, options);
      throw new Error('down');
    });
    const est = await call(rider, q);
    assert.equal(est.body.data.road, false);
    assert.ok(est.body.data.km > straight, 'an estimate is longer than the straight line');
  } finally {
    process.env.ROAD_DISTANCE_MODE = 'straight';
    mock.restoreAll();
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
