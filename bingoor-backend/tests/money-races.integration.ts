import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Order } from '../src/models/Order';
import { Settings } from '../src/models/Settings';
import { WalletTxn } from '../src/models/WalletTxn';
import { SellerTxn } from '../src/models/SellerTxn';
import { signAccessToken } from '../src/utils/jwt';

/*
 * Money must move exactly once even when the same request arrives several times
 * at the same moment (double tap, flaky network retry, or someone doing it on purpose).
 */
test('parallel withdrawals and "delivered" taps can never pay twice', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  // The unique indexes are the guard, so make sure they exist before the requests race.
  await Promise.all([WalletTxn.init(), SellerTxn.init()]);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const post = (path: string, token: string, body: unknown) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    await Settings.create({ key: 'global' });
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller', sellerStatus: 'approved', payout: { upi: 'owner@upi' } });
    const shop = await Shop.create({ name: 'Main', owner: owner._id, deliveryRadiusKm: 25, location: { type: 'Point', coordinates: [82.98, 25.32] } });
    const rider = await User.create({ name: 'Rider', phone: '9000000001', password: 'test-password', role: 'rider', warehouse: shop._id, payout: { upi: 'rider@upi' } });
    const riderToken = signAccessToken(String(rider._id), 'rider');
    const sellerToken = signAccessToken(String(owner._id), 'seller');

    // Rider: ₹500 earned, five withdrawals of ₹400 fired together -> only one is accepted.
    await WalletTxn.create({ rider: rider._id, kind: 'earning', amount: 500, status: 'completed', note: 'seed' });
    const riderTries = await Promise.all(Array.from({ length: 5 }, () => post('/rider/wallet/withdraw', riderToken, { amount: 400, method: 'upi' })));
    assert.deepEqual(riderTries.map((r) => r.status).filter((s) => s === 201).length, 1, `statuses: ${riderTries.map((r) => r.status)}`);
    assert.ok(riderTries.every((r) => r.status === 201 || r.status === 409));
    assert.equal(await WalletTxn.countDocuments({ rider: rider._id, kind: 'withdrawal' }), 1);

    // Seller: same story.
    await SellerTxn.create({ seller: owner._id, kind: 'earning', amount: 2000, status: 'completed', order: new Types.ObjectId() });
    const sellerTries = await Promise.all(Array.from({ length: 5 }, () => post('/seller/wallet/withdraw', sellerToken, { amount: 1500, method: 'upi' })));
    assert.equal(sellerTries.filter((r) => r.status === 201).length, 1, `statuses: ${sellerTries.map((r) => r.status)}`);
    assert.equal(await SellerTxn.countDocuments({ seller: owner._id, kind: 'withdrawal' }), 1);

    // Rider taps "delivered" three times at once -> one delivery, one earning.
    const { insertedId } = await Order.collection.insertOne({
      orderNumber: 'BG-RACE', user: new Types.ObjectId(), shop: shop._id, rider: rider._id, status: 'out_for_delivery',
      deliveryOtp: '4321', paymentMethod: 'online', items: [], subtotal: 100, deliveryFee: 0, discount: 0, total: 100,
      riderEarning: 0, statusHistory: [], createdAt: new Date(), updatedAt: new Date(),
    });
    const taps = await Promise.all(Array.from({ length: 3 }, () => post(`/rider/orders/${insertedId}/deliver`, riderToken, { otp: '4321' })));
    assert.equal(taps.filter((r) => r.status === 200).length, 1, `statuses: ${taps.map((r) => r.status)}`);
    assert.equal(await WalletTxn.countDocuments({ order: insertedId, kind: 'earning' }), 1, 'the delivery pay is credited once');
    const order = await Order.findById(insertedId).lean();
    assert.equal(order?.status, 'delivered');
    assert.equal(order?.deliveredWithoutOtp, false);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
