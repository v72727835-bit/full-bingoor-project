import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Settings } from '../src/models/Settings';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { signAccessToken } from '../src/utils/jwt';

/*
 * The live bug: a warehouse with an ordinary delivery radius (10 km, the admin default) made
 * every customer past 10 km "not serviceable", so "Next day delivery" (15-30 km) and
 * "3 days delivery" (30+ km) never showed and the header fell back to "19 minutes".
 * The distance tiers must hold everywhere - home, coverage, product list, product page, cart.
 */
test('15-30 km shows next day and 30+ km shows 3 days even when the warehouse radius is 10 km', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const W = { lat: 26.814162, lng: 75.773166 };
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller' });
    const customer = await User.create({ name: 'Customer', phone: '9000000001', password: 'test-password', role: 'customer' });
    const shop = await Shop.create({ name: 'Sanganer', owner: owner._id, deliveryRadiusKm: 10, isOpen: true, location: { type: 'Point', coordinates: [W.lng, W.lat] } });
    await Shop.init();
    await Settings.create({ key: 'global' });
    const dairy = await Category.create({ name: 'Dairy, Bread & Eggs', isActive: true, level: 1 });
    const milk = await Product.create({ name: 'Amul Milk', shop: shop._id, category: dairy._id, price: 30, mrp: 32, stock: 50 });
    await Cart.create({ user: customer._id, items: [{ product: milk._id, quantity: 2 }] });
    const auth = { authorization: `Bearer ${signAccessToken(String(customer._id), 'customer')}` };

    const pin = (km: number) => `lat=${W.lat + km / 111}&lng=${W.lng}`;
    const get = async (path: string) => {
      const r = await fetch(base + path, { headers: auth });
      return { status: r.status, body: (await r.json()) as any };
    };

    const cases: [number, number, string][] = [
      [0, 0, '19 minutes'], [9, 0, '19 minutes'], [14, 0, '19 minutes'],
      [16, 1, 'Next day delivery'], [20, 1, 'Next day delivery'], [25, 1, 'Next day delivery'], [29, 1, 'Next day delivery'],
      [31, 3, '3 days delivery'], [45, 3, '3 days delivery'],
    ];
    for (const [km, days, text] of cases) {
      const home = (await get(`/home?${pin(km)}`)).body.data;
      assert.equal(home.serviceable, true, `${km} km: home is serviceable`);
      assert.equal(home.deliveryDays, days, `${km} km: home deliveryDays`);
      assert.equal(home.deliveryText, text, `${km} km: header text`);

      const cov = (await get(`/coverage?${pin(km)}`)).body.data;
      assert.equal(cov.serviceable, true, `${km} km: coverage says we deliver`);

      const list = (await get(`/products?${pin(km)}`)).body.data as { name: string }[];
      assert.ok(list.some((p) => p.name === 'Amul Milk'), `${km} km: products are listed`);

      const page = (await get(`/products/${milk._id}?${pin(km)}`)).body.data;
      assert.equal(page.deliveryDays ?? 0, days, `${km} km: product page deliveryDays`);

      const quote = await get(`/cart/quote?${pin(km)}`);
      assert.equal(quote.status, 200, `${km} km: cart quote ${JSON.stringify(quote.body)}`);
      assert.equal(quote.body.data.days, days, `${km} km: cart quote days`);
    }
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
