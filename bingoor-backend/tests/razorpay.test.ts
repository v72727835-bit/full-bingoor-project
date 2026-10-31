import './env';
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { env } from '../src/config/env';
import { Integrations } from '../src/models/Integrations';
import { getIntegrations, invalidateIntegrations } from '../src/services/integrations.service';
import { createRazorpayOrder } from '../src/services/razorpay.service';
import { testRazorpayAdmin, updateIntegrationsAdmin } from '../src/controllers/adminExtra.controller';
import { seal } from '../src/utils/secretBox';

afterEach(() => {
  mock.restoreAll();
  invalidateIntegrations();
  delete env.RAZORPAY_KEY_ID;
  delete env.RAZORPAY_KEY_SECRET;
});
function saved(razorpay?: Record<string, unknown>) {
  const query: any = { lean: async () => razorpay ? { razorpay } : null };
  query.select = () => query;
  mock.method(Integrations, 'findOne', () => query);
}
const invoke = (handler: any, body = {}) => new Promise<any>((resolve) => {
  handler({ body }, { status() { return this; }, json: resolve }, resolve);
});

test('environment credentials work together when no admin credentials are saved', async () => {
  env.RAZORPAY_KEY_ID = 'rzp_test_environment';
  env.RAZORPAY_KEY_SECRET = 'environment-secret';
  saved();
  const config = await getIntegrations();
  assert.equal(config.razorpayKeyId, env.RAZORPAY_KEY_ID);
  assert.equal(config.razorpayKeySecret, env.RAZORPAY_KEY_SECRET);
});

test('saved Key ID is never combined with an unrelated environment secret', async () => {
  env.RAZORPAY_KEY_SECRET = 'unrelated-environment-secret';
  saved({ keyId: 'rzp_live_admin' });
  const config = await getIntegrations();
  assert.equal(config.razorpayKeyId, 'rzp_live_admin');
  assert.equal(config.razorpayKeySecret, undefined);
});

test('unreadable saved secret never silently falls back to an environment secret', async () => {
  env.RAZORPAY_KEY_SECRET = 'unrelated-environment-secret';
  saved({ keyId: 'rzp_live_admin', keySecretEnc: 'unreadable' });
  assert.equal((await getIntegrations()).razorpayKeySecret, undefined);
});

test('saved credentials are trimmed and sent together, with rupees converted to paise', async () => {
  saved({ keyId: ' rzp_test_admin ', keySecretEnc: seal(' admin-secret '), enabled: true });
  mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('rzp_test_admin:admin-secret').toString('base64'));
    assert.equal(JSON.parse(options.body).amount, 30100);
    return new Response(JSON.stringify({ id: 'order_test', amount: 30100, currency: 'INR' }), { status: 200 });
  });
  assert.equal((await createRazorpayOrder(301, 'receipt', {})).id, 'order_test');
});

test('gateway auth failure is distinguished from customer sign-in and leaks no credentials', async () => {
  saved({ keyId: 'rzp_test_admin', keySecretEnc: seal('private-secret'), enabled: true });
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 }));
  await assert.rejects(createRazorpayOrder(301, 'receipt', {}), (error: any) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.details.code, 'payment_gateway_auth_failed');
    assert.doesNotMatch(error.message, /private-secret|rzp_test_admin/);
    return true;
  });
});

test('admin key test explains how to fix rejected credentials', async () => {
  saved({ keyId: 'rzp_test_admin', keySecretEnc: seal('private-secret'), enabled: true });
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 }));
  const error = await invoke(testRazorpayAdmin);
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /matching Key ID and Key Secret/);
});

test('changing Key ID without its matching secret cannot overwrite saved credentials', async () => {
  saved({ keyId: 'rzp_test_old', keySecretEnc: seal('old-secret') });
  const update = mock.method(Integrations, 'updateOne', async () => ({}) as any);
  const error = await invoke(updateIntegrationsAdmin, { razorpayKeyId: 'rzp_live_new' });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /matching Key Secret/);
  assert.equal(update.mock.callCount(), 0);
});
