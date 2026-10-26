import crypto from 'crypto';
import { getIntegrations } from './integrations.service';
import { ApiError } from '../utils/ApiError';

/** Online payments run through Razorpay, with the keys the super admin saved in the admin panel. */
export async function razorpayKeys(): Promise<{ keyId: string; keySecret: string } | null> {
  const i = await getIntegrations();
  return i.razorpayEnabled && i.razorpayKeyId && i.razorpayKeySecret ? { keyId: i.razorpayKeyId, keySecret: i.razorpayKeySecret } : null;
}

export const razorpayEnabled = async (): Promise<boolean> => !!(await razorpayKeys());

/** The webhook signing secret set in the admin panel (or the RAZORPAY_WEBHOOK_SECRET env fallback). */
export async function razorpayWebhookSecret(): Promise<string | undefined> {
  return (await getIntegrations()).razorpayWebhookSecret;
}

async function call<T>(method: 'POST' | 'GET', path: string, body?: unknown, keys?: { keyId: string; keySecret: string }): Promise<T> {
  const k = keys ?? (await razorpayKeys());
  if (!k) throw new ApiError(503, 'Online payment is not switched on.');
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: 'Basic ' + Buffer.from(`${k.keyId}:${k.keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as { error?: { description?: string } };
  if (!r.ok) {
    if (r.status === 401 || r.status === 403 || /authentication failed/i.test(json.error?.description ?? '')) {
      throw new ApiError(503, 'Online payment is temporarily unavailable. Please contact the store or try again later.', { code: 'payment_gateway_auth_failed' });
    }
    throw new ApiError(502, json.error?.description || 'The payment service did not respond. Please try again.');
  }
  return json as T;
}

/** Amount is in rupees here; Razorpay wants paise. */
export const createRazorpayOrder = (rupees: number, receipt: string, notes: Record<string, string>) =>
  call<{ id: string; amount: number; currency: string }>('POST', '/orders', {
    amount: Math.round(rupees * 100),
    currency: 'INR',
    receipt,
    notes,
  });

/** The checkout signature is HMAC-SHA256 of "orderId|paymentId" with the key secret. */
export async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const keys = await razorpayKeys();
  if (!keys) return false;
  const expected = crypto.createHmac('sha256', keys.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const refundRazorpayPayment = (paymentId: string, rupees: number) =>
  call('POST', `/payments/${paymentId}/refund`, { amount: Math.round(rupees * 100) });

/** Admin's "Test keys" button: a harmless read that fails when the keys are wrong. */
export const testRazorpayKeys = (keys: { keyId: string; keySecret: string }) => call('GET', '/orders?count=1', undefined, keys);
