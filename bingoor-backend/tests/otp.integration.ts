import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { WalletTxn } from '../src/models/WalletTxn';
import { signAccessToken } from '../src/utils/jwt';

test('checkout OTP stays the same through customer tracking, rider pickup, wrong attempts and delivery', { timeout: 900000 }, async () => {
  // Core downloads the test database only when this integration suite runs,
  // keeping ordinary installs/builds free of MongoDB binary downloads.
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  try {
    const customer = await User.create({ name: 'OTP Customer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [{ label: 'home', name: 'Customer', phone: '9876543210', line1: 'Test address', city: 'Test city', state: 'UP', pincode: '231216', location: { lat: 24.701, lng: 83.071 } }] });
    const otherCustomer = await User.create({ name: 'Other Customer', phone: '9876543211', password: 'test-password', role: 'customer' });
    const category = await Category.create({ name: 'OTP test category' });
    const shops = await Promise.all([1, 2].map((i) => Shop.create({ name: `OTP warehouse ${i}`, owner: customer._id, location: { type: 'Point', coordinates: [83.07, 24.7] } })));
    const rider = await User.create({ name: 'OTP Rider', phone: '9876543212', password: 'test-password', role: 'rider', warehouse: shops[0]._id, warehouses: shops.map((s) => s._id) });
    const otherRider = await User.create({ name: 'Other Rider', phone: '9876543213', password: 'test-password', role: 'rider', warehouses: shops.map((s) => s._id) });
    const products = await Promise.all(shops.map((shop, i) => Product.create({ name: `OTP item ${i}`, shop: shop._id, category: category._id, price: 250, mrp: 250, stock: 10, isActive: true })));
    await Cart.create({ user: customer._id, items: products.map((p) => ({ product: p._id, quantity: 1 })) });
    const request = async (user: typeof customer, path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${signAccessToken(String(user._id), user.role)}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    };
    const placed = await request(customer, '/orders', 'POST', { addressId: String(customer.addresses[0]._id), paymentMethod: 'cod' });
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    const orders = placed.body.data.orders;
    assert.equal(orders.length, 2, 'one checkout creates a separate order per warehouse');
    for (const initial of orders) {
      assert.match(initial.deliveryOtp, /^\d{4}$/);
      const path = `/orders/${initial._id}`;
      assert.equal((await request(customer, path)).body.data.deliveryOtp, initial.deliveryOtp);
      assert.equal((await request(otherCustomer, path)).status, 404);
      await Order.updateOne({ _id: initial._id }, { $set: { status: 'ready_for_pickup' } });
      const pickup = await request(rider, `/rider${path}/accept`, 'POST', {});
      assert.equal(pickup.status, 200, JSON.stringify(pickup.body));
      assert.equal(pickup.body.data.deliveryOtp, undefined, 'rider must not receive the secret OTP');
      const customerView = await request(customer, path);
      assert.equal(customerView.body.data.deliveryOtp, initial.deliveryOtp);
      const wrong = initial.deliveryOtp === '9999' ? '8888' : '9999';
      for (let attempt = 0; attempt < 3; attempt++) {
        assert.equal((await request(rider, `/rider${path}/deliver`, 'POST', { otp: wrong })).status, 400);
        assert.equal((await request(customer, path)).body.data.deliveryOtp, initial.deliveryOtp, 'wrong attempts must not rotate the OTP');
      }
      assert.equal((await request(otherRider, `/rider${path}/deliver`, 'POST', { otp: initial.deliveryOtp })).status, 404);
      const delivered = await request(rider, `/rider${path}/deliver`, 'POST', { otp: ` ${customerView.body.data.deliveryOtp} ` });
      assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
      assert.equal(delivered.body.data.status, 'delivered');
      assert.equal(delivered.body.data.deliveryOtp, undefined);
      assert.equal((await request(customer, path)).body.data.deliveryOtp, undefined);
      assert.equal((await request(rider, `/rider${path}/deliver`, 'POST', { otp: initial.deliveryOtp })).status, 404, 'delivery cannot be replayed');
      assert.equal(await WalletTxn.countDocuments({ order: initial._id, kind: 'earning' }), 1);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
    await db.stop();
  }
});
