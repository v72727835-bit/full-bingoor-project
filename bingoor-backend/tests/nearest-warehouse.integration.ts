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
 * Varanasi scenario the user hit: two warehouses both cover the customer, each
 * stocks the same product, each has its own rider. The order must reach the
 * NEAREST warehouse (so its rider's bell rings), not always the same one.
 */
test('the customer is served by the nearest warehouse, so the order goes to its rider', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    // The customer lives near the second warehouse (Mansarovar), far from the first (Sanganer).
    const here = { lat: 25.32, lng: 82.98 };
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller' });
    const sanganer = await Shop.create({ name: 'Sanganer', owner: owner._id, deliveryRadiusKm: 25, location: { type: 'Point', coordinates: [82.90, 25.26] } }); // ~9 km away
    const mansarovar = await Shop.create({ name: 'Mansarovar', owner: owner._id, deliveryRadiusKm: 25, location: { type: 'Point', coordinates: [82.985, 25.322] } }); // ~0.6 km away
    const category = await Category.create({ name: 'Dairy' });
    await Settings.create({ key: 'global' });
    // The same item sits in both warehouses, both in stock.
    const milkFar = await Product.create({ name: 'Amul Milk', shop: sanganer._id, category: category._id, price: 30, mrp: 32, stock: 50, soldCount: 999 });
    await Product.create({ name: 'Amul Milk', shop: mansarovar._id, category: category._id, price: 30, mrp: 32, stock: 50, soldCount: 1 });

    const buyer = await User.create({ name: 'Buyer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Buyer', phone: '9876543210', line1: 'Near', city: 'Varanasi', state: 'Uttar Pradesh', pincode: '221002', location: here },
    ] });
    const auth = { authorization: `Bearer ${signAccessToken(String(buyer._id), 'customer')}` };
    const addressId = String(buyer.addresses[0]._id);

    // The listing at the customer's location shows only the nearest warehouse's stock,
    // even though the far warehouse's copy is far more popular (soldCount 999 vs 1).
    const list = (await (await fetch(`${base}/products?lat=${here.lat}&lng=${here.lng}`, { headers: auth })).json()) as { data: { _id: string; name: string; shop: { _id: string; name: string } }[] };
    assert.ok(list.data.length > 0, 'the customer sees products');
    for (const card of list.data) {
      assert.equal(card.shop.name, 'Mansarovar', `every product is from the nearest warehouse (got ${card.shop.name})`);
    }
    assert.notEqual(list.data.find((c) => c.name === 'Amul Milk')?._id, String(milkFar._id), 'not the far warehouse copy');
    const shown = list.data.find((c) => c.name === 'Amul Milk')!;

    // An order for it reaches the nearest warehouse, whose rider is the one near the customer.
    await Cart.create({ user: buyer._id, items: [{ product: shown._id, quantity: 7 }] });
    const res = await fetch(`${base}/orders`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ addressId, paymentMethod: 'cod' }) });
    assert.equal(res.status, 201, await res.clone().text());
    const order = await Order.findOne({ user: buyer._id }).lean();
    assert.equal(String(order?.shop), String(mansarovar._id), 'the order went to the nearest warehouse (Mansarovar), not the far one');
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
