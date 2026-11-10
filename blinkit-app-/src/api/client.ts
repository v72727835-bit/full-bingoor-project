import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config';
import { deliveryPointParams } from '../store/deliveryPoint';
import { tokenStore } from '../storage/tokens';
import { ApiEnvelope, AuthResult } from '../types';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  // The catalogue is limited to shops that deliver to the customer's pin.
  const url = config.url ?? '';
  const point = deliveryPointParams();
  const needsPoint =
    url === '/home' || url === '/products' || url === '/products/suggest' ||
    /^\/products\/[^/]+$/.test(url) || url === '/categories' || url.startsWith('/categories/');
  if (point && (config.method ?? 'get') === 'get' && needsPoint) {
    config.params = { ...point, ...config.params };
  }
  return config;
});

/** Trades the stored refresh token for a new pair. Returns the new access token, or null if it failed. */
async function refreshTokens(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefresh();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<ApiEnvelope<Pick<AuthResult, 'accessToken' | 'refreshToken'>>>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 15000 },
    );
    await tokenStore.save(data.data.accessToken, data.data.refreshToken);
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

// One refresh at a time, even if several requests fail together.
let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshing ??= refreshTokens().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      await tokenStore.clear();
      setAccessToken(null);
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

/** Human-friendly message for any error thrown by the API layer. */
type Problem = { shop?: string; name?: string; reason?: string };

/** Turns the checkout's machine reasons ("min_order_99") into a sentence a customer can act on. */
function explainProblem(p: Problem): string {
  const reason = p.reason ?? '';
  const shop = p.shop ?? 'This shop';
  const item = p.name ?? 'An item';
  if (reason === 'shop_closed') return `${shop} is closed right now`;
  if (reason === 'out_of_stock') return `${item} is out of stock - remove it from your cart`;
  if (reason === 'insufficient_stock') return `Only a few ${item} are left - lower the quantity`;
  if (reason === 'unavailable') return `${item} is no longer available - remove it from your cart`;
  const min = /^min_order_(\d+(?:\.\d+)?)$/.exec(reason);
  if (min) return `${shop} needs a minimum order of ₹${min[1]}`;
  const range = /^out_of_delivery_range_(\d+(?:\.\d+)?)km$/.exec(reason);
  if (range) return `${shop} delivers only within ${range[1]} km - your delivery address is too far. Pick a closer address.`;
  return `${p.name ?? p.shop ?? 'An item'}: ${reason.replace(/_/g, ' ')}`;
}

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return err.code === 'ECONNABORTED'
        ? 'The server took too long to respond. Please try again.'
        : 'Cannot reach the server. Check your internet connection and the API URL.';
    }
    const data = err.response.data as { message?: string; details?: unknown } | undefined;
    // Checkout explains exactly what is wrong in `details`; show that, not the generic headline.
    if (Array.isArray(data?.details) && data.details.length && typeof data.details[0] === 'object') {
      return Array.from(new Set((data.details as Problem[]).map(explainProblem))).join('. ');
    }
    const message = data?.message;
    if (message) return message;
    return `Something went wrong (${err.response.status}). Please try again.`;
  }
  return 'Something went wrong. Please try again.';
}

/** Field-level messages from a 400 validation response, e.g. { phone: "Enter a valid ..." }. */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const details = (err.response?.data as { details?: Record<string, unknown> } | undefined)?.details;
  if (!details || typeof details !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(details)) {
    if (field.startsWith('_')) continue;
    if (Array.isArray(value) && typeof value[0] === 'string') out[field] = value[0];
  }
  return out;
}

/** If the server asked for an OTP (HTTP 428), returns the phone number it wants verified ('' when it did not say). */
export function otpRequiredPhone(err: unknown): string | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 428) return null;
  const d = (err.response.data as { details?: { code?: string; phone?: string } } | undefined)?.details;
  return d?.code === 'otp_required' ? d.phone ?? '' : null;
}
