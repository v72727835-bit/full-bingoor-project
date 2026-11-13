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
import { signAccessToken } from '../src/utils/jwt';

/*
 * After the customer fills and saves an address, the app queries the catalogue
 * at that pin. Everything a warehouse there stocks must show: the home feed is
 * serviceable with products, the categories list is there, and the product list
 * returns the items - all from the warehouse that serves that location.
 */
test('the catalogue at a saved location shows every product and category available there', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const here = { lat: 26.85, lng: 75.80 }; // the pin the customer confirmed
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller' });
    const shop = await Shop.create({ name: 'Mansarovar', owner: owner._id, deliveryRadiusKm: 25, isOpen: true, location: { type: 'Point', coordinates: [75.802, 26.851] } });
    await Settings.create({ key: 'global' });
    const dairy = await Category.create({ name: 'Dairy, Bread & Eggs', isActive: true, level: 1 });
    const snacks = await Category.create({ name: 'Chips & Namkeen', isActive: true, level: 1 });
    await Product.create([
      { name: 'Amul Milk', shop: shop._id, category: dairy._id, price: 30, mrp: 32, stock: 50 },
      { name: 'Brown Bread', shop: shop._id, category: dairy._id, price: 40, mrp: 45, stock: 50 },
      { name: 'Aloo Bhujia', shop: shop._id, category: snacks._id, price: 50, mrp: 55, stock: 50 },
    ]);

    // The home feed's "shops near you" uses a $near query, which needs the shop's
    // 2dsphere index. Production builds it on boot; build it here too.
    await Shop.init();

    const token = signAccessToken(String(owner._id), 'seller'); // any logged-in user; catalogue is public
    const auth = { authorization: `Bearer ${token}` };

    // Home feed for that pin: serviceable, with products.
    const home = (await (await fetch(`${base}/home?lat=${here.lat}&lng=${here.lng}`, { headers: auth })).json()) as {
      data: { serviceable: boolean; popularProducts: { name: string; shop: { name: string } }[]; categories: unknown[] };
    };
    assert.equal(home.data.serviceable, true, 'the location is serviceable');
    assert.ok(home.data.popularProducts.length >= 3, `home shows the products (got ${home.data.popularProducts.length})`);
    for (const p of home.data.popularProducts) assert.equal(p.shop.name, 'Mansarovar');

    // The product list for that pin returns every item in stock there.
    const list = (await (await fetch(`${base}/products?lat=${here.lat}&lng=${here.lng}`, { headers: auth })).json()) as { data: { name: string }[] };
    const names = list.data.map((p) => p.name).sort();
    assert.deepEqual(names, ['Aloo Bhujia', 'Amul Milk', 'Brown Bread']);

    // The categories list is there for that pin.
    const cats = (await (await fetch(`${base}/categories?lat=${here.lat}&lng=${here.lng}`, { headers: auth })).json()) as { data: { name: string }[] };
    const catNames = cats.data.map((c) => c.name);
    assert.ok(catNames.includes('Dairy, Bread & Eggs') && catNames.includes('Chips & Namkeen'), `categories show (got ${catNames.join(', ')})`);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
