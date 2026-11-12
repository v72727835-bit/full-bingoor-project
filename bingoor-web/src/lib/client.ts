'use client';

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import { pointParams } from './deliveryPoint';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

const ACCESS_KEY = 'bingoor_access';
const REFRESH_KEY = 'bingoor_refresh';
const USER_KEY = 'bingoor_user';

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const tokens = {
  get access() {
    return safeGet(ACCESS_KEY);
  },
  get refresh() {
    return safeGet(REFRESH_KEY);
  },
  get user(): unknown | null {
    const raw = safeGet(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(access: string, refresh: string, user?: unknown) {
    safeSet(ACCESS_KEY, access);
    safeSet(REFRESH_KEY, refresh);
    if (user) safeSet(USER_KEY, JSON.stringify(user));
  },
  clear() {
    safeRemove(ACCESS_KEY);
    safeRemove(REFRESH_KEY);
    safeRemove(USER_KEY);
  },
};

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn;
};

api.interceptors.request.use((config) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  // The catalogue is limited to shops that deliver to the customer's pin.
  const url = config.url ?? '';
  // Catalogue calls that depend on where the customer is: the home feed, product lists
  // and a single product (its delivery time), the festival tab, and the category menu.
  const needsPoint =
    url === '/home' || url === '/products' || url === '/products/suggest' || url === '/festival' ||
    /^\/products\/[^/]+$/.test(url) || url === '/categories' || url.startsWith('/categories/');
  if ((config.method ?? 'get') === 'get' && needsPoint) {
    const point = pointParams();
    if (point) config.params = { ...point, ...config.params };
  }
  return config;
});

async function refreshTokens(): Promise<string | null> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
    tokens.save(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
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
      tokens.clear();
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

type Problem = { shop?: string; name?: string; reason?: string };

/** Turns the checkout's machine reasons ("min_order_99") into a sentence a customer can act on. */
function explainProblem(p: Problem): string {
  const reason = p.reason ?? '';
  const item = p.name ?? 'An item';
  // Warehouses are never named to the customer: the basket is one shop.
  if (reason === 'shop_closed') return `${item === 'An item' ? 'Some items' : item} cannot be delivered right now - remove them or try again later`;
  if (reason === 'out_of_stock') return `${item} is out of stock - remove it from your cart`;
  if (reason === 'insufficient_stock') return `Only a few ${item} are left - lower the quantity`;
  if (reason === 'unavailable') return `${item} is no longer available - remove it from your cart`;
  if (reason === 'points_short') return 'Please add 1 product from the list below your cart to continue';
  if (reason === 'cod_unavailable') return `Cash on delivery is not available for ${item} - choose Pay online or remove it`;
  if (reason === 'online_unavailable') return `Online payment is not available for ${item} - choose Cash on Delivery or remove it`;
  if (reason === 'cod_long_distance') return 'Your address is far away, so cash on delivery is not available - choose Pay online';
  if (reason.startsWith('pay_option_off_')) return 'That way of paying is switched off right now - please choose another';
  const min = /^min_order_(\d+(?:\.\d+)?)$/.exec(reason);
  if (min) return `Shop for at least ₹${min[1]} to place this order`;
  const range = /^out_of_delivery_range_(\d+(?:\.\d+)?)km$/.exec(reason);
  if (range) return `We deliver only within ${range[1]} km - your delivery address is too far. Pick a closer address.`;
  return `${p.name ?? 'Your cart'}: ${reason.replace(/_/g, ' ')}`;
}

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You are offline. Reconnect to the internet and try again.';
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return 'The store is taking longer to respond. Please try again shortly.';
      return 'Could not connect to the store. Please try again shortly.';
    }
    const payload = err.response.data as
      | { message?: string; errors?: Record<string, string[] | string>; details?: unknown }
      | undefined;
    // Checkout explains exactly what is wrong in `details`; show that, not the generic headline.
    if (Array.isArray(payload?.details) && payload.details.length && typeof payload.details[0] === 'object') {
      return Array.from(new Set((payload.details as Problem[]).map(explainProblem))).join('. ');
    }
    // Field problems arrive as an object in `details` (older servers used `errors`).
    const fields =
      payload?.errors ??
      (payload?.details && typeof payload.details === 'object' && !Array.isArray(payload.details)
        ? (payload.details as Record<string, string[] | string>)
        : undefined);
    const details =
      fields &&
      Object.entries(fields)
        .flatMap(([field, value]) => {
          const messages = Array.isArray(value) ? value : [value];
          return messages.filter(Boolean).map((msg) => (field === '_form' ? msg : `${field}: ${msg}`));
        })
        .join(', ');
    // The server's own headline is already a readable sentence; the raw field list is the fallback.
    const message = payload?.message && payload.message !== 'Validation failed' ? payload.message : details || payload?.message;
    return message ?? `Something went wrong (${err.response.status}).`;
  }
  return 'Something went wrong.';
}
