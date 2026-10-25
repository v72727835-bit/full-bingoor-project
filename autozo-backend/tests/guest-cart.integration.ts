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
import { Settings } from '../src/models/Settings';

test('a visitor without an account can price a cart and get a delivery quote', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const owner = await User.create({ name: 'Owner', phone: '9876500000', password: 'test-password', role: 'shop' });
    const shop = await Shop.create({ name: 'Warehouse', owner: owner._id, deliveryRadiusKm: 200, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const category = await Category.create({ name: 'Atta' });
    await Settings.create({ key: 'global' });
    const atta = await Product.create({ name: 'Atta 5 kg', shop: shop._id, category: category._id, price: 250, mrp: 300, stock: 3 });
    const gone = new mongoose.Types.ObjectId();

    const res = await fetch(`${base}/cart/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: String(atta._id), quantity: 2 }, { productId: String(atta._id), quantity: 1 }, { productId: String(gone), quantity: 1 }], lat: 24.701, lng: 83.071 }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { itemCount: number; subtotal: number; groups: { items: { productId: string; quantity: number }[] }[]; quote: { handlingFee: number; distanceKm: number } } };
    // Same product twice adds up; the unknown product is dropped.
    assert.equal(body.data.groups.length, 1);
    assert.equal(body.data.groups[0].items.length, 1);
    assert.equal(body.data.groups[0].items[0].quantity, 3);
    assert.equal(body.data.subtotal, 750);
    assert.equal(body.data.quote.handlingFee, 2);
    assert.ok(body.data.quote.distanceKm < 1);

    const bad = await fetch(`${base}/cart/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ productId: 'nope', quantity: 1 }] }) });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
