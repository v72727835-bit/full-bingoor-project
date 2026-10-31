import './env';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test, mock } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { PaymentIntent } from '../src/models/PaymentIntent';
import { Integrations } from '../src/models/Integrations';
import { invalidateIntegrations } from '../src/services/integrations.service';
import { seal } from '../src/utils/secretBox';
import { signAccessToken } from '../src/utils/jwt';

test('online-only checkout preserves cart on gateway failure and places paid orders only after valid confirmation', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const originalFetch = globalThis.fetch;
  try {
    const user = await User.create({ name: 'Online Customer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [{ label: 'home', name: 'Customer', phone: '9876543210', line1: 'Test address', city: 'Test city', state: 'UP', pincode: '231216', location: { lat: 24.701, lng: 83.071 } }] });
    const shop = await Shop.create({ name: 'Online warehouse', owner: user._id, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const category = await Category.create({ name: 'Online category' });
    const product = await Product.create({ name: 'Online-only product', shop: shop._id, category: category._id, price: 299, mrp: 299, stock: 10, isActive: true, paymentMode: 'online' });
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 1 }] });
    await Integrations.create({ key: 'global', razorpay: { keyId: 'rzp_test_fixture', keySecretEnc: seal('fixture-secret'), enabled: true } });
    invalidateIntegrations();
    let rejectGateway = true;
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      if (!String(url).startsWith('https://api.razorpay.com/')) return originalFetch(url, options);
      // No external gateway requests or real payments occur in this test.
      assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('rzp_test_fixture:fixture-secret').toString('base64'));
      if (rejectGateway) return new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 });
      return new Response(JSON.stringify({ id: 'order_fixture', amount: 30100, currency: 'INR' }), { status: 200 });
    });
    const request = async (path: string, body: unknown) => {
      const response = await originalFetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${signAccessToken(String(user._id), 'customer')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() as any };
    };
    const checkout = { addressId: String(user.addresses[0]._id), paymentMethod: 'online' };
    const failed = await request('/orders', checkout);
    assert.equal(failed.status, 503);
    assert.equal(failed.body.details.code, 'payment_gateway_auth_failed');
    assert.equal(await Order.countDocuments(), 0);
    assert.equal(await PaymentIntent.countDocuments(), 0);
    assert.equal((await Product.findById(product._id))?.stock, 10);
    assert.equal((await Cart.findOne({ user: user._id }))?.items.length, 1);
    rejectGateway = false;
    const prepared = await request('/orders', checkout);
    assert.equal(prepared.status, 201, JSON.stringify(prepared.body));
    assert.equal(prepared.body.data.requiresPayment, true);
    assert.equal(prepared.body.data.keyId, 'rzp_test_fixture');
    assert.equal(prepared.body.data.amount, 30100);
    assert.equal(await Order.countDocuments(), 0, 'payment window preparation must not place an unpaid order');
    const confirmation = { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: '0'.repeat(64) };
    assert.equal((await request('/orders/online/confirm', confirmation)).status, 400);
    assert.equal(await Order.countDocuments(), 0);
    confirmation.razorpay_signature = crypto.createHmac('sha256', 'fixture-secret').update('order_fixture|pay_fixture').digest('hex');
    const paid = await request('/orders/online/confirm', confirmation);
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    assert.equal(paid.body.data.orders[0].paymentStatus, 'paid');
    assert.equal((await Product.findById(product._id))?.stock, 9);
    assert.equal((await Cart.findOne({ user: user._id }))?.items.length, 0);
    assert.equal((await request('/orders/online/confirm', confirmation)).status, 409);
    assert.equal(await Order.countDocuments(), 1, 'repeat confirmation must not create a duplicate order');
  } finally {
    mock.restoreAll();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
    await db.stop();
  }
});
