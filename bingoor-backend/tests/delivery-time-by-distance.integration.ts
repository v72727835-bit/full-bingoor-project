import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Settings } from '../src/models/Settings';

/*
 * The header's delivery promise follows the customer's distance from the nearest
 * warehouse: up to 15 km "19 minutes", 15-30 km "Next day delivery", beyond 30 km
 * "3 days delivery" - even when the admin's fast-slot label has no time in it.
 */
test('delivery time follows distance: 0-15 km 19 minutes, 15-30 km next day, 30+ km 3 days', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const owner = await User.create({ name: 'Owner', phone: '9000000000', password: 'test-password', role: 'seller' });
    await Shop.create({ name: 'Sanganer', owner: owner._id, deliveryRadiusKm: 1000, isOpen: true, location: { type: 'Point', coordinates: [75.773166, 26.814162] } });
    await Shop.init();
    // The live admin saved a label with no time in it - the header must not show it.
    await Settings.create({ key: 'global', deliverySlots: [{ key: 'instant', label: 'fast delivery', enabled: true }] });

    const at = async (kmNorth: number | null) => {
      const q = kmNorth === null ? '' : `?lat=${26.814162 + kmNorth / 111}&lng=75.773166`;
      return ((await (await fetch(`${base}/home${q}`)).json()) as { data: { deliveryDays: number; deliveryText: string; serviceable: boolean } }).data;
    };

    for (const km of [0, 5, 14]) {
      const h = await at(km);
      assert.equal(h.deliveryDays, 0, `${km} km is same day`);
      assert.equal(h.deliveryText, '19 minutes', `${km} km shows 19 minutes`);
    }
    for (const km of [16, 25, 29]) {
      const h = await at(km);
      assert.equal(h.deliveryDays, 1, `${km} km is next day`);
      assert.equal(h.deliveryText, 'Next day delivery');
    }
    for (const km of [31, 45, 120]) {
      const h = await at(km);
      assert.equal(h.serviceable, true, `${km} km is still served`);
      assert.equal(h.deliveryDays, 3, `${km} km is 3 days`);
      assert.equal(h.deliveryText, '3 days delivery');
    }
    // No location yet: the default promise is still a real time, not "fast delivery".
    assert.equal((await at(null)).deliveryText, '19 minutes');
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
