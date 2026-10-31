import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Settings } from '../src/models/Settings';
import { integrationsBody } from '../src/validators/schemas';

test('settings saved before newer fields existed come back with their defaults when not lean', () => {
  const doc = Settings.hydrate({ _id: new Types.ObjectId(), key: 'global', cartPoints: { enabled: false, target: 47, suggestions: [] } });
  const s = doc.toObject();
  assert.deepEqual(s.twoHourCharge, { enabled: false, amount: 0 });
  assert.equal(s.filters.length, 6);
  assert.equal(s.pricing.bands.length, 4);
  assert.equal(s.deliverySlots.length, 3);
});

test('social login ids must have the right shape', () => {
  assert.equal(integrationsBody.safeParse({ googleClientId: 'GOCSPX-abcdef' }).success, false);
  assert.equal(integrationsBody.safeParse({ facebookAppId: 'admin@bingoor.com' }).success, false);
  assert.equal(integrationsBody.safeParse({ googleClientId: '123-abc.apps.googleusercontent.com', facebookAppId: '1234567890123456' }).success, true);
  assert.equal(integrationsBody.safeParse({ googleClientId: '', facebookAppId: '' }).success, true);
});
