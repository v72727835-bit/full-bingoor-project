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
import { StandardCategory } from '../src/models/StandardCategory';
import { clearCatalogCache } from '../src/middleware/cache';
import { signAccessToken } from '../src/utils/jwt';

test('long-distance customers see only the ticked categories, standard rows and festival products; cards carry their sizes', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const get = async (path: string) => (await (await fetch(base + path)).json()) as any;
  try {
    const owner = await User.create({ name: 'Owner', phone: '9000000002', password: 'test-password', role: 'customer' });
    const shop = await Shop.create({ name: 'Warehouse', owner: owner._id, deliveryRadiusKm: 200, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const atta = await Category.create({ name: 'Atta' });
    const sweets = await Category.create({ name: 'Sweets' });
    const row = await StandardCategory.create({ name: 'Diwali Deals' });
    const make = (name: string, category: unknown, extra: Record<string, unknown> = {}) =>
      Product.create({ name, shop: shop._id, category, price: 100, mrp: 120, stock: 10, ...extra });
    await make('Aashirvaad Atta', atta._id, { variantGroup: 'aashirvaad-atta', variantLabel: '5 kg', unit: '5 kg', price: 250 });
    await make('Aashirvaad Atta', atta._id, { variantGroup: 'aashirvaad-atta', variantLabel: '10 kg', unit: '10 kg', price: 480 });
    await make('Plain sweet', sweets._id);
    await make('Row sweet', sweets._id, { standardCategories: [row._id] });
    const festProduct = await make('Festival sweet', sweets._id);
    await Settings.create({
      key: 'global',
      pricing: { beyondCategories: [atta._id], beyondStandardCategories: [row._id], beyondProducts: [festProduct._id] },
    });
    clearCatalogCache();

    const names = async (lat: number, lng: number) =>
      ((await get(`/products?lat=${lat}&lng=${lng}&limit=50`)).data as { name: string }[]).map((p) => p.name).sort();

    // About 70 km away: past the last 30 km row.
    assert.deepEqual(await names(25.336, 83.008), ['Aashirvaad Atta', 'Festival sweet', 'Row sweet']);
    // Near the warehouse: everything.
    assert.deepEqual(await names(24.701, 83.071), ['Aashirvaad Atta', 'Festival sweet', 'Plain sweet', 'Row sweet']);

    // Point 22: each size's card lists both sizes, cheapest first; single-size items have none.
    const cards = (await get('/products?limit=50')).data as { name: string; variants?: { label: string; price: number }[] }[];
    const five = cards.find((c) => c.name === 'Aashirvaad Atta')!;
    assert.deepEqual(five.variants?.map((v) => [v.label, v.price]), [['5 kg', 250], ['10 kg', 480]]);
    assert.equal(cards.filter((c) => c.name === 'Aashirvaad Atta').length, 1, 'variant sizes appear in one product card');
    assert.equal(cards.find((c) => c.name === 'Plain sweet')!.variants, undefined);

    // A short flat / house number such as "15" is a valid address line.
    const auth = { 'content-type': 'application/json', authorization: `Bearer ${signAccessToken(String(owner._id), 'customer')}` };
    const addr = await fetch(`${base}/me/addresses`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ label: 'home', name: 'kd', phone: '7854789652', line1: '15', line2: '45, Priyanshu Vihar Road, Sirsi', city: 'Jaipur', state: 'Rajasthan', pincode: '302041', location: { lat: 26.9, lng: 75.7 } }),
    });
    assert.equal(addr.status, 201, await addr.text());

    // Instagram login refuses politely until the admin saves its keys.
    const ig = await fetch(`${base}/auth/instagram`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abcdefghijklmnop', redirectUri: 'https://bingoor.com/auth/instagram' }),
    });
    assert.equal(ig.status, 503);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
