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
 * When the super admin adds a product with "All warehouses", it is stocked in
 * every warehouse (one listing each). A specific warehouse still adds just one.
 */
test('the super admin can add a product to every warehouse at once', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const admin = await User.create({ name: 'Admin', phone: '9000000001', password: 'test-password', role: 'admin' });
    const a = await Shop.create({ name: 'Sanganer', owner: admin._id, location: { type: 'Point', coordinates: [75.80, 26.85] } });
    const b = await Shop.create({ name: 'Mansarovar', owner: admin._id, location: { type: 'Point', coordinates: [75.78, 26.86] } });
    const c = await Shop.create({ name: 'Vaishali', owner: admin._id, location: { type: 'Point', coordinates: [75.74, 26.91] } });
    const main = await Category.create({ name: 'Grocery', level: 1, parent: null });
    const sub = await Category.create({ name: 'Dry Fruits', level: 2, parent: main._id });
    const child = await Category.create({ name: 'Almonds', level: 3, parent: sub._id });
    const token = signAccessToken(String(admin._id), 'admin');

    const post = (body: Record<string, unknown>) => fetch(`${base}/admin/products`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ category: String(child._id), name: 'Kaju 250g', price: 300, mrp: 350, unit: '250 g', stock: 20, ...body }),
    });

    // All warehouses: one listing in each of the three.
    const all = await post({ allWarehouses: true });
    assert.equal(all.status, 201, await all.clone().text());
    const kaju = await Product.find({ name: 'Kaju 250g' }).lean();
    assert.equal(kaju.length, 3, 'one listing per warehouse');
    assert.deepEqual(kaju.map((p) => String(p.shop)).sort(), [String(a._id), String(b._id), String(c._id)].sort());

    // A specific warehouse: just that one.
    const one = await post({ shop: String(b._id), name: 'Badam 250g' });
    assert.equal(one.status, 201, await one.clone().text());
    const badam = await Product.find({ name: 'Badam 250g' }).lean();
    assert.equal(badam.length, 1);
    assert.equal(String(badam[0].shop), String(b._id));
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
