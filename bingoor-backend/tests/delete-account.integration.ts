import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Order } from '../src/models/Order';
import { signAccessToken } from '../src/utils/jwt';

test('a customer deletes their own account (password needed, not while an order is open)', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const user = await User.create({ name: 'Delete Me', phone: '9876500099', email: 'del@example.com', password: 'secret-123', role: 'customer', addresses: [{ label: 'home', name: 'Delete Me', phone: '9876500099', line1: 'Flat 1', line2: 'Main road', city: 'X', state: 'UP', pincode: '231216' }] });
    const call = async (body: unknown) => {
      const r = await fetch(`${base}/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${signAccessToken(String(user._id), 'customer')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, body: (await r.json()) as { message?: string } };
    };

    assert.equal((await call({ password: 'wrong' })).status, 401, 'a wrong password does not delete');

    const open = await Order.collection.insertOne({ user: user._id, status: 'out_for_delivery', orderNumber: 'T1', items: [], total: 10 });
    assert.equal((await call({ password: 'secret-123' })).status, 409, 'not while an order is on its way');
    await Order.collection.updateOne({ _id: open.insertedId }, { $set: { status: 'delivered' } });

    const done = await call({ password: 'secret-123' });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const gone = await User.findById(user._id).lean();
    assert.equal(gone?.isActive, false);
    assert.equal(gone?.name, 'Deleted user');
    assert.notEqual(gone?.phone, '9876500099');
    assert.equal(gone?.email, undefined);
    assert.equal(gone?.addresses.length, 0);
    // the phone number is free again for a new sign-up
    assert.ok(await User.create({ name: 'New', phone: '9876500099', password: 'another-1', role: 'customer' }));

    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'del@example.com', password: 'secret-123' }) });
    assert.equal(login.status, 401, 'the old login no longer works');
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
