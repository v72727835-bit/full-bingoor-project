import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Settings } from '../src/models/Settings';
import { signAccessToken } from '../src/utils/jwt';

test('Delivery & pricing settings load with old saved settings and deleted top-up products', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const admin = await User.create({ name: 'Admin', phone: '9000000001', password: 'test-password', role: 'admin' });
    const auth = { 'content-type': 'application/json', authorization: `Bearer ${signAccessToken(String(admin._id), 'admin')}` };
    // Saved before twoHourCharge / filters existed, with a top-up product that was later deleted.
    await Settings.collection.insertOne({ key: 'global', cartPoints: { enabled: false, target: 47, suggestions: [new Types.ObjectId()] } });

    const r = await fetch(`${base}/admin/settings`, { headers: auth });
    assert.equal(r.status, 200);
    const s = ((await r.json()) as { data: any }).data;
    assert.deepEqual(s.cartPoints.suggestions, []);
    assert.deepEqual(s.twoHourCharge, { enabled: false, amount: 0 });
    assert.equal(s.filters.length, 6);
    assert.equal(s.pricing.bands.length, 4);

    // Wrong values in the social login fields are refused with a clear message.
    const bad = await fetch(`${base}/admin/integrations`, { method: 'PUT', headers: auth, body: JSON.stringify({ googleClientId: 'GOCSPX-notTheId' }) });
    assert.equal(bad.status, 400);
    const badFb = await fetch(`${base}/admin/integrations`, { method: 'PUT', headers: auth, body: JSON.stringify({ facebookAppId: 'admin@bingoor.com' }) });
    assert.equal(badFb.status, 400);
    const good = await fetch(`${base}/admin/integrations`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ googleClientId: '123-abc.apps.googleusercontent.com', facebookAppId: '1234567890123456' }),
    });
    assert.equal(good.status, 200);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
