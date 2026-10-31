import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { catalogCache, clearCatalogCache } from '../src/middleware/cache';
import { mapLimit } from '../src/utils/mapLimit';
import { createCatalogResource } from '../../bingoor-web/src/lib/catalogResource';

test('concurrent public requests share work, isolate locations, and never cache failures', async () => {
  clearCatalogCache();
  const app = express();
  let calls = 0;
  app.get('/home', catalogCache, async (req, res) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 40));
    res.status(req.query.fail ? 503 : 200).json({ location: req.query.lat, calls });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const burst = await Promise.all(Array.from({ length: 20 }, () => fetch(base + '/home?lat=25')));
    assert.equal(calls, 1, '20 simultaneous visitors should cause one database read');
    assert.ok(burst.every((r) => r.status === 200));
    assert.equal(burst.filter((r) => r.headers.get('X-Cache') === 'COALESCED').length, 19);
    assert.equal((await fetch(base + '/home?lat=25')).headers.get('X-Cache'), 'HIT');
    assert.equal((await (await fetch(base + '/home?lat=26')).json()).location, '26');
    assert.equal(calls, 2);
    const failed = await fetch(base + '/home?fail=1');
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
    await fetch(base + '/home?fail=1');
    assert.equal(calls, 4, 'failed responses must not poison the cache');
    clearCatalogCache();
    const before = fetch(base + '/home?lat=30');
    await new Promise((resolve) => setTimeout(resolve, 10));
    clearCatalogCache();
    await before;
    assert.equal((await fetch(base + '/home?lat=30')).headers.get('X-Cache'), 'MISS', 'in-flight old data must not refill an invalidated cache');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    clearCatalogCache();
  }
});

test('homepage section reads stay bounded and preserve merchandising order', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapLimit(Array.from({ length: 24 }, (_, i) => i), 4, async (i) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, (i % 3) + 1));
    active--;
    return i;
  });
  assert.equal(peak, 4);
  assert.deepEqual(result, Array.from({ length: 24 }, (_, i) => i));
});

test('browser public cache shares requests, separates delivery points, and permits forced refresh', async () => {
  let calls = 0;
  const resource = createCatalogResource(async (key) => { calls++; await Promise.resolve(); return key; });
  const first = resource('location-A');
  assert.equal(first, resource('location-A'));
  assert.equal(await first, 'location-A');
  assert.equal(await resource('location-A'), 'location-A');
  assert.equal(calls, 1);
  assert.equal(await resource('location-B'), 'location-B');
  await resource('location-A', true);
  assert.equal(calls, 3);
});

test('browser cache drops failed requests so recovery can succeed', async () => {
  let fail = true;
  const resource = createCatalogResource(async () => { if (fail) throw new Error('offline'); return 'recovered'; });
  await assert.rejects(resource('location'), /offline/);
  fail = false;
  assert.equal(await resource('location'), 'recovered');
});
