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

const WEBHOOK_SECRET = 'whsec_fixture';
const KEY_SECRET = 'fixture-secret';

test('Razorpay webhook places the paid order even without the client, and is idempotent; cancel auto-refunds', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const originalFetch = globalThis.fetch;

  const refundCalls: { paymentId: string; amount: number }[] = [];
  try {
    const user = await User.create({
      name: 'Webhook Customer', phone: '9876543210', password: 'test-password', role: 'customer',
      addresses: [{ label: 'home', name: 'Customer', phone: '9876543210', line1: 'Test address', city: 'Test city', state: 'UP', pincode: '231216', location: { lat: 24.701, lng: 83.071 } }],
    });
    const shop = await Shop.create({ name: 'Webhook warehouse', owner: user._id, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const category = await Category.create({ name: 'Webhook category' });
    const product = await Product.create({ name: 'Online product', shop: shop._id, category: category._id, price: 299, mrp: 299, stock: 10, isActive: true, paymentMode: 'online' });
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 1 }] });
    await Integrations.create({ key: 'global', razorpay: { keyId: 'rzp_test_fixture', keySecretEnc: seal(KEY_SECRET), webhookSecretEnc: seal(WEBHOOK_SECRET), enabled: true } });
    invalidateIntegrations();

    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      const u = String(url);
      if (!u.startsWith('https://api.razorpay.com/')) return originalFetch(url, options);
      if (u.includes('/orders')) return new Response(JSON.stringify({ id: 'order_wh', amount: 30100, currency: 'INR' }), { status: 200 });
      const refundMatch = /\/payments\/([^/]+)\/refund/.exec(u);
      if (refundMatch) {
        refundCalls.push({ paymentId: refundMatch[1], amount: JSON.parse(options.body).amount });
        return new Response(JSON.stringify({ id: 'rfnd_1', status: 'processed' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const token = signAccessToken(String(user._id), 'customer');
    const authed = async (path: string, body?: unknown) =>
      originalFetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const postWebhook = async (payloadString: string, signature: string) =>
      originalFetch(base + '/orders/online/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature }, body: payloadString });

    // 1) Start the payment (creates a PaymentIntent, no order yet).
    const prepared = await authed('/orders', { addressId: String(user.addresses[0]._id), paymentMethod: 'online' });
    assert.equal(prepared.status, 201);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal(await PaymentIntent.countDocuments({ razorpayOrderId: 'order_wh', status: 'created' }), 1);

    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh', order_id: 'order_wh' } } } });

    // 2) Bad signature is rejected and places nothing.
    const bad = await postWebhook(payload, 'deadbeef');
    assert.equal(bad.status, 400);
    assert.equal(await Order.countDocuments(), 0);

    // 3) Valid signature places the order even though the client never confirmed.
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    const ok1 = await postWebhook(payload, sig);
    assert.equal(ok1.status, 200);
    assert.equal(await Order.countDocuments(), 1, 'webhook must place the paid order');
    const placed = await Order.findOne({});
    assert.equal(placed?.paymentStatus, 'paid');
    assert.equal(placed?.paymentRef, 'pay_wh');
    assert.equal((await PaymentIntent.findOne({ razorpayOrderId: 'order_wh' }))?.status, 'paid');
    assert.equal((await Product.findById(product._id))?.stock, 9);
    assert.equal((await Cart.findOne({ user: user._id }))?.items.length, 0);

    // 4) A duplicate webhook is idempotent (no second order).
    const ok2 = await postWebhook(payload, sig);
    assert.equal(ok2.status, 200);
    assert.equal(await Order.countDocuments(), 1, 'duplicate webhook must not create a second order');

    // 5) Cancelling the paid order auto-refunds via Razorpay and marks it refunded.
    const cancel = await authed(`/orders/${placed!._id}/cancel`, { reason: 'changed my mind' });
    assert.equal(cancel.status, 200, await cancel.text());
    assert.equal(refundCalls.length, 1, 'cancel of a paid online order must trigger a refund');
    assert.equal(refundCalls[0].paymentId, 'pay_wh');
    assert.equal(refundCalls[0].amount, Math.round((placed!.total) * 100));
    assert.equal((await Order.findById(placed!._id))?.paymentStatus, 'refunded');
    assert.equal((await Product.findById(product._id))?.stock, 10, 'cancel restores stock');
  } finally {
    mock.restoreAll();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await mongoose.disconnect();
    await db.stop();
  }
});
