import './env';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Settings } from '../src/models/Settings';
import { Order } from '../src/models/Order';
import { WalletTxn } from '../src/models/WalletTxn';
import { creditDeliveryEarning } from '../src/services/riderPay.service';
import { ridersForOrder } from '../src/services/orderFlow.service';
import { clearRoadCache } from '../src/services/roadDistance.service';
import { signAccessToken } from '../src/utils/jwt';

/*
 * An order placed while distances were still straight lines keeps that old km. Wherever it is used
 * (the rider's pay, the warehouse's assign panel) it is measured by road, and saved so it is not asked again.
 * The customer's live "km away" is the road from the rider's position to the door.
 */
test('old straight-line orders are corrected to road km, and the customer sees road km to the door', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const originalFetch = globalThis.fetch;
  process.env.ROAD_DISTANCE_MODE = 'road';
  clearRoadCache();
  try {
    const W = { lat: 26.8, lng: 75.8 };
    const home = { lat: 26.93, lng: 75.8 }; // about 14.5 km in a straight line
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller' });
    const customer = await User.create({ name: 'Cust', phone: '9000000001', password: 'test-password', role: 'customer' });
    const rider = await User.create({ name: 'Rider', phone: '9000000002', password: 'test-password', role: 'rider' });
    const other = await User.create({ name: 'Other', phone: '9000000003', password: 'test-password', role: 'customer' });
    await Settings.create({ key: 'global' });
    const shop = await Shop.create({ name: 'WH', owner: owner._id, deliveryRadiusKm: 10, isOpen: true, location: { type: 'Point', coordinates: [W.lng, W.lat] } });
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      if (!String(url).startsWith('https://router.project-osrm.org/')) return originalFetch(url, options);
      return new Response(JSON.stringify({ code: 'Ok', distances: [[0, 19900]] }), { status: 200 }); // the road is 19.9 km
    });
    const mk = async (extra: Record<string, unknown>) => (await Order.collection.insertOne({
      orderNumber: `BG-${Math.random().toString(36).slice(2, 8)}`, checkoutId: 'c', user: customer._id, shop: shop._id, rider: rider._id,
      status: 'out_for_delivery', paymentMethod: 'cod', items: [], subtotal: 500, deliveryFee: 0, discount: 0, total: 540,
      address: { name: 'Cust', phone: '9000000001', line1: 'x', city: 'Jaipur', state: 'Rajasthan', pincode: '302041', location: home },
      statusHistory: [], createdAt: new Date(), updatedAt: new Date(), ...extra,
    })).insertedId as Types.ObjectId;

    // 1. Placed with the old straight-line km (14.5): the rider is paid for the road (19.9), and it is saved.
    const oldId = await mk({ distanceKm: 14.5 });
    await creditDeliveryEarning(oldId);
    const txn = await WalletTxn.findOne({ rider: rider._id, kind: 'earning' }).lean();
    assert.equal(txn?.km, 19.9, 'paid for the road km, not the 14.5 straight line');
    const healed = await Order.findById(oldId).lean();
    assert.equal(healed?.distanceKm, 19.9);
    assert.equal((healed as any)?.distanceRoad, true, 'saved as a road distance');

    // 2. The warehouse assign panel shows the road km too.
    const old2 = await mk({ distanceKm: 14.5 });
    assert.equal((await ridersForOrder(String(old2))).distanceKm, 19.9);

    // 3. An order already measured by road is not measured again.
    mock.restoreAll();
    let calls = 0;
    mock.method(globalThis, 'fetch', async (url: any, options: any) => { if (String(url).startsWith('https://router.project-osrm.org/')) { calls++; throw new Error('should not be asked'); } return originalFetch(url, options); });
    const newId = await mk({ distanceKm: 12.3, distanceRoad: true });
    assert.equal((await ridersForOrder(String(newId))).distanceKm, 12.3);
    assert.equal(calls, 0);

    // 4. The customer's live km to the door is the road from the rider's position.
    mock.restoreAll();
    clearRoadCache();
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      if (!String(url).startsWith('https://router.project-osrm.org/')) return originalFetch(url, options);
      return new Response(JSON.stringify({ code: 'Ok', distances: [[0, 7400]] }), { status: 200 });
    });
    const trackId = await mk({ riderLocation: { lat: 26.85, lng: 75.82, at: new Date() } });
    const get = async (who: { _id: unknown; role: string }, id: unknown) => {
      const r = await originalFetch(`${base}/orders/${id}/rider-distance`, { headers: { Authorization: `Bearer ${signAccessToken(String(who._id), who.role)}` } });
      return { status: r.status, body: (await r.json()) as any };
    };
    const live = await get(customer, trackId);
    assert.equal(live.status, 200, JSON.stringify(live.body));
    assert.equal(live.body.data.km, 7.4);
    assert.equal(live.body.data.road, true);
    assert.equal((await get(other, trackId)).status, 404, 'only the customer of that order');
    const noLoc = await mk({});
    assert.equal((await get(customer, noLoc)).body.data.km, null, 'no rider position yet');
  } finally {
    process.env.ROAD_DISTANCE_MODE = 'straight';
    mock.restoreAll();
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
