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
import { signAccessToken } from '../src/utils/jwt';

/*
 * A sub category can have no child (e.g. Grocery & Kitchen > Dry Fruits with nothing
 * under it). A product must still be addable there - on the sub category itself.
 */
test('a product can be added on a sub category that has no child', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const admin = await User.create({ name: 'Admin', phone: '9000000001', password: 'test-password', role: 'admin' });
    const shop = await Shop.create({ name: 'Warehouse', owner: admin._id, deliveryRadiusKm: 20, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const main = await Category.create({ name: 'Grocery & Kitchen', level: 1, parent: null });
    const sub = await Category.create({ name: 'Dry Fruits', level: 2, parent: main._id }); // no child under it
    const child = await Category.create({ name: 'Almonds', level: 3, parent: sub._id });

    const admin2 = signAccessToken(String(admin._id), 'admin');
    const seller = await fetch(`${base}/admin/sellers`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${admin2}` },
      body: JSON.stringify({ name: 'Seller', phone: '9000000003', password: 'seller-pass', warehouses: [String(shop._id)], kind: 'product' }),
    });
    assert.equal(seller.status, 201);
    const sellerId = ((await seller.json()) as { data: { _id: string } }).data._id;
    const sellerToken = signAccessToken(sellerId, 'seller');

    const create = (category: string, name: string) => fetch(`${base}/seller/products`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ category, name, price: 300, mrp: 350, unit: '250 g', stock: 20, warehouse: String(shop._id) }),
    });

    // On the sub category (no child): allowed now.
    const onSub = await create(String(sub._id), 'Kaju 250g');
    assert.equal(onSub.status, 201, await onSub.clone().text());
    assert.equal(String((await Product.findOne({ name: 'Kaju 250g' }).lean())?.category), String(sub._id));

    // On a child category: still allowed.
    const onChild = await create(String(child._id), 'Badam 250g');
    assert.equal(onChild.status, 201, await onChild.clone().text());

    // On the top (level 1) category: not a leaf, still refused.
    const onMain = await create(String(main._id), 'Loose item');
    assert.equal(onMain.status, 400);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
