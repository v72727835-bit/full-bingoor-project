import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codTimeBlocked, quoteDelivery } from '../src/services/pricing.service';

test('COD cut-off: disabled passes, enabled blocks only after the time (IST)', () => {
  // Disabled: never blocked.
  assert.equal(codTimeBlocked({ cod: { cutoffEnabled: false } } as never).blocked, false);

  // Build a UTC instant that is 20:00 IST (14:30 UTC) and 10:00 IST (04:30 UTC).
  const at = (istHour: number, istMin = 0) => {
    const utcMin = istHour * 60 + istMin - 330;
    const d = new Date(Date.UTC(2026, 0, 2, 0, 0, 0));
    return new Date(d.getTime() + ((utcMin + 1440) % 1440) * 60_000);
  };
  const settings = { cod: { cutoffEnabled: true, cutoffTime: '19:00', cutoffMessage: 'After 7 PM COD option is not available' } } as never;

  const before = codTimeBlocked(settings, at(18, 30));
  assert.equal(before.blocked, false);

  const after = codTimeBlocked(settings, at(20, 0));
  assert.equal(after.blocked, true);
  assert.equal(after.message, 'After 7 PM COD option is not available');
});

test('long-distance (beyond the last band) uses beyondFee when set', () => {
  const settings = {
    pricing: {
      handlingFee: 2,
      bands: [{ upToKm: 10, minOrder: 199, freeAbove: 199, fee: 30, nextDay: false, redOrder: false }],
      beyondDays: 3,
      beyondMinOrder: 199,
      beyondFee: 90,
    },
  } as never;
  // 50 km is past the 10 km band -> long distance, beyondFee applies.
  const far = quoteDelivery(settings, { subtotal: 100, distanceKm: 50, slot: 'instant' });
  assert.equal(far.longDistance, true);
  assert.equal(far.baseDeliveryFee, 90);
  // Within the band -> the band's own fee.
  const near = quoteDelivery(settings, { subtotal: 100, distanceKm: 5, slot: 'instant' });
  assert.equal(near.longDistance, false);
  assert.equal(near.baseDeliveryFee, 30);
});
