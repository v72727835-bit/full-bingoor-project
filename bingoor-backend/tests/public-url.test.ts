import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request } from 'express';
import { publicOrigin, upgradeOwnLinks } from '../src/utils/publicUrl';

const req = (host: string, proto = 'http', forwarded?: string) =>
  ({ protocol: proto, get: (h: string) => (h.toLowerCase() === 'host' ? host : h.toLowerCase() === 'x-forwarded-proto' ? forwarded : undefined) }) as unknown as Request;

test('links handed out for a public host are always https', () => {
  assert.equal(publicOrigin(req('api.bingoor.com')), 'https://api.bingoor.com');
  assert.equal(publicOrigin(req('api.bingoor.com', 'http', 'http')), 'https://api.bingoor.com');
});

test('local hosts keep their own scheme (laptop, emulator, LAN)', () => {
  assert.equal(publicOrigin(req('localhost:5000')), 'http://localhost:5000');
  assert.equal(publicOrigin(req('10.0.2.2:5000')), 'http://10.0.2.2:5000');
  assert.equal(publicOrigin(req('192.168.1.5:5000', 'http', 'https')), 'https://192.168.1.5:5000');
});

test('our own http links in a response become https; other hosts are untouched', () => {
  const body = {
    data: {
      topTabs: [{ image: 'http://api.bingoor.com/uploads/products/a.jpg' }, { image: null }],
      shop: { logo: 'http://bingoor.com/logo.png', other: 'http://example.com/x.png', safe: 'https://api.bingoor.com/u.jpg' },
      text: 'see http://notbingoor.com.evil.io/x',
      when: new Date('2026-11-02T00:00:00Z'),
    },
  };
  const out = upgradeOwnLinks(body) as typeof body;
  assert.equal(out.data.topTabs[0].image, 'https://api.bingoor.com/uploads/products/a.jpg');
  assert.equal(out.data.shop.logo, 'https://bingoor.com/logo.png');
  assert.equal(out.data.shop.other, 'http://example.com/x.png');
  assert.equal(out.data.shop.safe, 'https://api.bingoor.com/u.jpg');
  assert.equal(out.data.text, 'see http://notbingoor.com.evil.io/x');
});

test('a response without our http links is passed through as is', () => {
  const body = { a: 1, b: 'https://api.bingoor.com/x' };
  assert.equal(upgradeOwnLinks(body), body);
  assert.equal(upgradeOwnLinks(undefined), undefined);
});
