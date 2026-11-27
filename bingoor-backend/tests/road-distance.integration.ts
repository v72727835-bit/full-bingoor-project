import './env';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Settings } from '../src/models/Settings';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { WalletTxn } from '../src/models/WalletTxn';
import { creditDeliveryEarning } from '../src/services/riderPay.service';
import { clearRoadCache } from '../src/services/roadDistance.service';
import { signAccessToken } from '../src/utils/jwt';
import { haversineKm } from '../src/utils/helpers';

/*
 * Distances follow the ROAD, not the straight line: the nearest warehouse is the one with the shortest
 * road, the km shown to the customer, the delivery time and fee, and the rider's pay all use road km.
 */
test('nearest warehouse, delivery time, fee and rider pay all go by road km, not the straight line', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const originalFetch = globalThis.fetch;
  process.env.ROAD_DISTANCE_MODE = 'road';
  clearRoadCache();
  try {
    const P = { lat: 26.85, lng: 75.80 }; // the customer
    const S1 = { lat: P.lat + 4 / 111, lng: P.lng }; // 4 km away in a straight line, but across a river: the road is long
    const S2 = { lat: P.lat, lng: P.lng + 9 / 99.5 }; // 9 km away in a straight line, an easy road
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller' });
    const customer = await User.create({ name: 'Priya', phone: '9000000001', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Priya', phone: '9000000001', line1: 'Flat 4', city: 'Jaipur', state: 'Rajasthan', pincode: '302020', location: P, isDefault: true },
    ] });
    const rider = await User.create({ name: 'Rider', phone: '9000000002', password: 'test-password', role: 'rider' });
    const shop1 = await Shop.create({ name: 'Across the river', owner: owner._id, deliveryRadiusKm: 10, isOpen: true, location: { type: 'Point', coordinates: [S1.lng, S1.lat] } });
    const shop2 = await Shop.create({ name: 'Easy road', owner: owner._id, deliveryRadiusKm: 10, isOpen: true, location: { type: 'Point', coordinates: [S2.lng, S2.lat] } });
    await Shop.init();
    await Settings.create({ key: 'global' });
    const cat = await Category.create({ name: 'Dairy', isActive: true, level: 1 });
    const milk = await Product.create({ name: 'Milk', shop: shop2._id, category: cat._id, price: 40, mrp: 45, stock: 50 });
    await Cart.create({ user: customer._id, items: [{ product: milk._id, quantity: 6 }] });
    assert.ok(haversineKm(P.lat, P.lng, S1.lat, S1.lng) < haversineKm(P.lat, P.lng, S2.lat, S2.lng), 'in a straight line S1 is nearer');

    // The roads (metres): S1 is far by road, S2 is near. Mutable so each scenario sets its own.
    const roads: Record<string, number> = {};
    const roadFor = (lng: number, lat: number) => (Math.abs(lat - S1.lat) < 1e-4 && Math.abs(lng - S1.lng) < 1e-4 ? roads.s1 : roads.s2);
    let osrmCalls = 0;
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      const u = String(url);
      if (!u.startsWith('https://router.project-osrm.org/')) return originalFetch(url, options);
      osrmCalls++;
      const coords = (u.split('/driving/')[1].split('?')[0]).split(';').map((c) => c.split(',').map(Number)); // [lng, lat]
      if (u.includes('/table/')) return new Response(JSON.stringify({ code: 'Ok', distances: [[0, ...coords.slice(1).map(([lng, lat]) => roadFor(lng, lat))]] }), { status: 200 });
      const [dlng, dlat] = coords[1];
      return new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: roadFor(dlng, dlat), geometry: { coordinates: [coords[0], [coords[0][0] + 0.01, coords[0][1] + 0.02], coords[1]] } }] }), { status: 200 });
    });
    const auth = { authorization: `Bearer ${signAccessToken(String(customer._id), 'customer')}` };
    const get = async (path: string) => ({ ...(await (await originalFetch(base + path, { headers: auth })).json() as any) });
    const at = `lat=${P.lat}&lng=${P.lng}`;

    // 1. Scenario A: S1 is 22 km by road, S2 is 11 km by road. The nearest by ROAD is S2.
    roads.s1 = 22_000; roads.s2 = 11_000;
    let cov = (await get(`/coverage?${at}`)).data;
    assert.equal(cov.nearest.distanceKm, 11, 'the road km, not the 9 km straight line');
    assert.equal(cov.nearest.road, true);
    assert.ok(Math.abs(cov.nearest.lat - S2.lat) < 1e-6 && Math.abs(cov.nearest.lng - S2.lng) < 1e-6, 'the shortest road wins over the shortest straight line');
    assert.equal(cov.nearest.deliveryDays, 0);
    assert.equal(cov.nearest.route, undefined, 'the road to draw is only sent when asked for');

    // 2. The road to draw comes with route=1 (as [lat, lng] points), not a straight line.
    cov = (await get(`/coverage?${at}&route=1`)).data;
    assert.ok(Array.isArray(cov.nearest.route) && cov.nearest.route.length >= 3, 'road points to draw');
    assert.equal(cov.nearest.route[0].length, 2);

    // 3. Scenario B: both are long by road (S2 16 km): 9 km straight would say "19 minutes", the road says next day.
    // (a new pin, since the catalogue answers are shared for 30 seconds per pin)
    clearRoadCache();
    roads.s1 = 40_000; roads.s2 = 16_000;
    const at2 = `lat=${P.lat + 0.002}&lng=${P.lng}`;
    cov = (await get(`/coverage?${at2}`)).data;
    assert.equal(cov.nearest.distanceKm, 16);
    assert.equal(cov.nearest.deliveryDays, 1);
    assert.equal(cov.nearest.deliveryText, 'Next day delivery');
    const home = (await get(`/home?${at2}`)).data;
    assert.equal(home.deliveryDays, 1, 'the header follows the road km');
    assert.equal(home.deliveryText, 'Next day delivery');

    // 4. The cart's quote uses the road km.
    const quote = (await get(`/cart/quote?${at2}`)).data;
    assert.equal(quote.distanceKm, 16);
    assert.equal(quote.days, 1);

    // 5. The order keeps the road km, and the rider is paid for it (not the 9 km straight line).
    const placed = await originalFetch(`${base}/orders`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ addressId: String(customer.addresses[0]._id), paymentMethod: 'cod' }) });
    assert.equal(placed.status, 201, await placed.clone().text());
    const order = await Order.findOne({ user: customer._id }).lean();
    assert.equal(order?.distanceKm, 16, 'the order stores the road km');
    await Order.updateOne({ _id: order!._id }, { $set: { rider: rider._id, status: 'delivered', deliveredAt: new Date() } });
    const paid = await creditDeliveryEarning(order!._id);
    const txn = await WalletTxn.findOne({ rider: rider._id, kind: 'earning' }).lean();
    assert.equal(txn?.km, 16, 'the rider is paid for the road km');
    assert.equal(paid, 86, 'Rs 10 base + Rs 40 (first 10 km) + 6 km x Rs 6; the 9 km straight line would have paid Rs 50');

    // 6. The same trip is remembered: asking again does not ask the road service again.
    const before = osrmCalls;
    await get(`/coverage?${at2}&route=0`);
    assert.equal(osrmCalls, before, 'cached');
    void shop1;
  } finally {
    process.env.ROAD_DISTANCE_MODE = 'straight';
    mock.restoreAll();
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
