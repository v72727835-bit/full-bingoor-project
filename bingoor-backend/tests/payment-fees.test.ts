import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentFee, paymentOptions } from '../src/services/pricing.service';

test('payment charges follow the default formula (#36)', () => {
  assert.equal(paymentFee(null, 'cod', 1000), 0);
  assert.equal(paymentFee(null, 'upi', 1000), 0);
  assert.equal(paymentFee(null, 'rupay', 1000), 0);
  assert.equal(paymentFee(null, 'debit', 1000), 4); // 0.40% up to 1999
  assert.equal(paymentFee(null, 'debit', 1999), 8);
  assert.equal(paymentFee(null, 'debit', 2000), 18); // 0.90% from 2000
  assert.equal(paymentFee(null, 'netbanking', 1000), 18);
  assert.equal(paymentFee(null, 'credit', 1000), 20);
  assert.equal(paymentFee(null, undefined, 1000), 0);
});

test('admin-saved charges win over the defaults, missing ones fall back', () => {
  const settings = { paymentOptions: [{ key: 'credit' as const, label: 'Credit card', enabled: true, pct: 3.98 }] };
  assert.equal(paymentFee(settings, 'credit', 100), 3.98);
  assert.equal(paymentFee(settings, 'netbanking', 100), 1.8);
  assert.equal(paymentOptions(settings).length, 6);
});
