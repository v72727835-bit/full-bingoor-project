import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { signAccessToken } from '../src/utils/jwt';

test('admin writes blog posts; the website shows only published ones', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const admin = await User.create({ name: 'Admin', phone: '9000000001', password: 'test-password', role: 'admin' });
    const auth = { 'content-type': 'application/json', authorization: `Bearer ${signAccessToken(String(admin._id), 'admin')}` };
    const post = async (body: object) => {
      const r = await fetch(`${base}/admin/blog`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
      assert.equal(r.status, 201);
      return ((await r.json()) as { data: { _id: string; slug: string; publishedAt?: string } }).data;
    };

    const live = await post({ title: 'How we deliver fast', body: '<p><b>Hello</b></p>', cover: '/uploads/a.jpg', published: true });
    const draft = await post({ title: 'Secret draft', body: '<p>soon</p>' });
    assert.ok(live.publishedAt);

    const list = (await (await fetch(`${base}/blog`)).json()) as { data: { title: string }[] };
    assert.deepEqual(list.data.map((p) => p.title), ['How we deliver fast']);
    assert.equal((await fetch(`${base}/blog/${live.slug}`)).status, 200);
    assert.equal((await fetch(`${base}/blog/${draft.slug}`)).status, 404);

    // Publishing the draft shows it on the website right away (cache cleared by the admin write).
    const pub = await fetch(`${base}/admin/blog/${draft._id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ published: true }) });
    assert.equal(pub.status, 200);
    const after = (await (await fetch(`${base}/blog`)).json()) as { data: unknown[] };
    assert.equal(after.data.length, 2);

    assert.equal((await fetch(`${base}/admin/blog/${draft._id}`, { method: 'DELETE', headers: auth })).status, 200);
    assert.equal((await fetch(`${base}/blog/${draft.slug}`)).status, 404);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
