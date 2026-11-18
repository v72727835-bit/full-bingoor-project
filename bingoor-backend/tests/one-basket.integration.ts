import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { Settings } from '../src/models/Settings';
import { signAccessToken } from '../src/utils/jwt';

/*
 * Items from two warehouses (e.g. Sanganer and Mansarovar), each under the Rs 199
 * minimum and each warehouse with its own minimum: the basket is one shop to the
 * customer, so the cart total decides, and the fees are charged once.
 */
test('a basket filled by two warehouses has one minimum and one set of fees', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const user = await User.create({ name: 'Buyer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Buyer', phone: '9876543210', line1: 'Near', city: 'Jaipur', state: 'Rajasthan', pincode: '302020', location: { lat: 26.85, lng: 75.77 } },
    ] });
    const near = { type: 'Point', coordinates: [75.77, 26.851] };
    const sanganer = await Shop.create({ name: 'Sanganer', owner: user._id, deliveryRadiusKm: 50, minOrderAmount: 150, location: near });
    const mansarovar = await Shop.create({ name: 'Mansarovar', owner: user._id, deliveryRadiusKm: 50, minOrderAmount: 150, location: near });
    const category = await Category.create({ name: 'Grocery' });
    await Settings.create({ key: 'global' });
    const dal = await Product.create({ name: 'Dal', shop: sanganer._id, category: category._id, price: 120, mrp: 130, stock: 10 });
    const rice = await Product.create({ name: 'Rice', shop: mansarovar._id, category: category._id, price: 100, mrp: 110, stock: 10 });
    await Cart.create({ user: user._id, items: [{ product: dal._id, quantity: 1 }, { product: rice._id, quantity: 1 }] });
    const auth = { authorization: `Bearer ${signAccessToken(String(user._id), 'customer')}` };
    const addressId = String(user.addresses[0]._id);

    const cart = (await (await fetch(`${base}/cart`, { headers: auth })).json()) as { data: { hasIssues: boolean; groups: { meetsMinOrder: boolean }[] } };
    assert.equal(cart.data.hasIssues, false, 'no per-warehouse minimum blocks the cart');
    assert.ok(cart.data.groups.every((g) => g.meetsMinOrder));

    const q = (await (await fetch(`${base}/cart/quote?addressId=${addressId}`, { headers: auth })).json()) as {
      data: { subtotal: number; minOrder: number; meetsMinOrder: boolean; handlingFee: number; deliveryFee: number; total: number };
    };
    // 220 of items meets the Rs 199 minimum and the Rs 199 free-delivery mark nearby; one Rs 2 handling fee.
    assert.equal(q.data.subtotal, 220);
    assert.equal(q.data.meetsMinOrder, true);
    assert.equal(q.data.deliveryFee, 0);
    assert.equal(q.data.handlingFee, 2);
    assert.equal(q.data.total, 222);

    const res = await fetch(`${base}/orders`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ addressId, paymentMethod: 'cod' }) });
    assert.equal(res.status, 201, await res.clone().text());
    const orders = await Order.find({ user: user._id }).lean();
    assert.equal(orders.length, 2);
    // Charged once across the checkout, so the orders add up to the quote.
    assert.equal(orders.reduce((s, o) => s + o.total, 0), 222);
    assert.equal(orders.reduce((s, o) => s + (o.handlingFee ?? 0), 0), 2);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});

test('the basket minimum is judged on the whole cart beyond 9 km', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const user = await User.create({ name: 'Buyer', phone: '9876543211', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Buyer', phone: '9876543211', line1: 'Near', city: 'Jaipur', state: 'Rajasthan', pincode: '302020', location: { lat: 26.85, lng: 75.77 } },
    ] });
    // Keep this case in the 9–15 km band, which still has a ₹199 checkout
    // minimum. Within 9 km a smaller basket may be placed with the delivery fee.
    const midDistance = { type: 'Point', coordinates: [75.66, 26.851] };
    const a = await Shop.create({ name: 'A', owner: user._id, deliveryRadiusKm: 50, location: midDistance });
    const b = await Shop.create({ name: 'B', owner: user._id, deliveryRadiusKm: 50, location: midDistance });
    const category = await Category.create({ name: 'Grocery' });
    await Settings.create({ key: 'global' });
    const x = await Product.create({ name: 'X', shop: a._id, category: category._id, price: 50, mrp: 60, stock: 10 });
    const y = await Product.create({ name: 'Y', shop: b._id, category: category._id, price: 60, mrp: 70, stock: 10 });
    await Cart.create({ user: user._id, items: [{ product: x._id, quantity: 1 }, { product: y._id, quantity: 1 }] });
    const auth = { authorization: `Bearer ${signAccessToken(String(user._id), 'customer')}` };
    const addressId = String(user.addresses[0]._id);

    const res = await fetch(`${base}/orders`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ addressId, paymentMethod: 'cod' }) });
    assert.equal(res.status, 409);
    const body = (await res.json()) as { errors?: { reason: string }[]; details?: { reason: string }[] };
    const reasons = (body.errors ?? body.details ?? []).map((p) => p.reason);
    assert.deepEqual(reasons, ['min_order_199'], 'one cart-level minimum, not one per warehouse');
    assert.equal(await Order.countDocuments({ user: user._id }), 0);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
