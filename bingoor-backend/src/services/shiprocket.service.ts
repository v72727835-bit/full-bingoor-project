import { IOrder } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { getIntegrations } from './integrations.service';

/**
 * Shiprocket courier network. The super admin saves an API user's email and
 * password in the admin panel; we log in once, cache the bearer token, and use
 * it to push an accepted order to Shiprocket for pickup and delivery.
 */
const BASE = 'https://apiv2.shiprocket.in/v1/external';

export interface ShiprocketCreds {
  email: string;
  password: string;
  pickupLocation?: string;
  channelId?: string;
}

export async function shiprocketCreds(): Promise<ShiprocketCreds | null> {
  const i = await getIntegrations();
  const s = i.shiprocket;
  return s.enabled && s.email && s.password
    ? { email: s.email, password: s.password, pickupLocation: s.pickupLocation, channelId: s.channelId }
    : null;
}

export const shiprocketEnabled = async (): Promise<boolean> => !!(await shiprocketCreds());

// Shiprocket tokens last ten days; refresh a day early so a sync never fails on an expired one.
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
let tokenCache: { at: number; token: string; email: string } | null = null;

export function invalidateShiprocketToken() {
  tokenCache = null;
}

async function token(creds: ShiprocketCreds): Promise<string> {
  if (tokenCache && tokenCache.email === creds.email && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token;
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const j = (await r.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!r.ok || !j.token) throw new ApiError(502, j.message || 'Shiprocket login failed. Check the API email and password.');
  tokenCache = { at: Date.now(), token: j.token, email: creds.email };
  return j.token;
}

async function call<T>(method: 'GET' | 'POST', path: string, body: unknown, creds: ShiprocketCreds): Promise<T> {
  const t = await token(creds);
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) invalidateShiprocketToken(); // force a fresh login next time
  const j = (await r.json().catch(() => ({}))) as { message?: string; errors?: unknown };
  if (!r.ok) {
    const detail = typeof j.message === 'string' ? j.message : j.errors ? JSON.stringify(j.errors) : '';
    throw new ApiError(502, detail || 'Shiprocket did not accept this request. Please try again.');
  }
  return j as T;
}

/** Admin's "Test" button: logs in and lists the pickup locations so a typo in the name is caught early. */
export async function testShiprocket() {
  const creds = await shiprocketCreds();
  if (!creds) throw new ApiError(400, 'Save the Shiprocket API email and password first, and switch Shiprocket on.');
  const j = await call<{ data?: { shipping_address?: { pickup_location?: string }[] } }>('GET', '/settings/company/pickup', undefined, creds);
  const pickupLocations = (j.data?.shipping_address ?? []).map((a) => a.pickup_location).filter(Boolean) as string[];
  return { ok: true, pickupLocations };
}

export interface ShiprocketResult {
  orderId: string;
  shipmentId: string;
  awb: string;
  courier: string;
  status: string;
}

/** Create an ad-hoc order in Shiprocket from one of our orders, ready for a courier to pick up. */
export async function createShiprocketOrder(order: IOrder): Promise<ShiprocketResult> {
  const creds = await shiprocketCreds();
  if (!creds) throw new ApiError(400, 'Shiprocket is not switched on.');
  if (!creds.pickupLocation) throw new ApiError(400, 'Set the Shiprocket pickup location name in Integrations first (it must match a pickup location in your Shiprocket account).');
  const a = order.address;
  const parts = (a.name || 'Customer').trim().split(/\s+/);
  const firstName = parts.shift() || 'Customer';
  const lastName = parts.join(' ') || '.';
  const payload: Record<string, unknown> = {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt).toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: creds.pickupLocation,
    comment: order.note || '',
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: a.line1,
    billing_address_2: a.line2 || '',
    billing_city: a.city,
    billing_pincode: a.pincode,
    billing_state: a.state,
    billing_country: 'India',
    billing_email: 'orders@bingoor.com',
    billing_phone: a.phone,
    shipping_is_billing: true,
    order_items: order.items.map((i) => ({ name: i.name, sku: String(i.product), units: i.quantity, selling_price: i.price })),
    payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: order.subtotal,
    length: 15,
    breadth: 15,
    height: 10,
    weight: 0.5,
  };
  if (creds.channelId) payload.channel_id = creds.channelId;
  const j = await call<{ order_id?: number | string; shipment_id?: number | string; status?: string; awb_code?: string; courier_name?: string }>(
    'POST',
    '/orders/create/adhoc',
    payload,
    creds,
  );
  return {
    orderId: j.order_id != null ? String(j.order_id) : '',
    shipmentId: j.shipment_id != null ? String(j.shipment_id) : '',
    awb: j.awb_code || '',
    courier: j.courier_name || '',
    status: j.status || 'NEW',
  };
}
