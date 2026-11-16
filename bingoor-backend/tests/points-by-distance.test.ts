import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pointsTarget } from '../src/services/pricing.service';

const bands = [
  { upToKm: 9, minOrder: 199, freeAbove: 199, fee: 39, nextDay: false, redOrder: false, points: 0 },
  { upToKm: 15, minOrder: 199, freeAbove: 999, fee: 39, nextDay: false, redOrder: true, points: 70 },
  { upToKm: 25, minOrder: 199, freeAbove: 999, fee: 39, nextDay: true, redOrder: false, points: 150 },
  { upToKm: 30, minOrder: 199, freeAbove: 1999, fee: 39, nextDay: true, redOrder: false, points: 180 },
];
const settings = (extra: Record<string, unknown> = {}, on = true) =>
  ({ cartPoints: { enabled: on, target: 50, suggestions: [] }, pricing: { handlingFee: 2, bands, beyondDays: 3, beyondMinOrder: 199, ...extra } }) as never;

test('cart points needed follow the distance band', () => {
  assert.equal(pointsTarget(settings(), 5), 0, 'up to 9 km: not needed');
  assert.equal(pointsTarget(settings(), 12), 70);
  assert.equal(pointsTarget(settings(), 20), 150);
  assert.equal(pointsTarget(settings(), 28), 180);
  assert.equal(pointsTarget(settings(), 45), 180, 'past the last band: the last row unless set');
  assert.equal(pointsTarget(settings({ beyondPoints: 220 }), 45), 220);
  assert.equal(pointsTarget(settings(), null), 50, 'no location: the global target');
  assert.equal(pointsTarget(settings({}, false), 20), 0, 'rule off: nothing needed');
});

test('a band without its own number uses the global target', () => {
  const s = { cartPoints: { enabled: true, target: 47, suggestions: [] }, pricing: { bands: [{ upToKm: 10, minOrder: 0, freeAbove: 0, fee: 0, nextDay: false, redOrder: false }] } } as never;
  assert.equal(pointsTarget(s, 3), 47);
});
