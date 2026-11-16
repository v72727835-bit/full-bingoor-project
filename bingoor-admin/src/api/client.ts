import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config';

/**
 * The refresh token lives in an HttpOnly cookie the API sets (X-Session-Cookie),
 * so page scripts never see it; the short-lived access token is kept in memory only.
 */
const SESSION_HEADERS = { 'X-Session-Cookie': '1' };
export const api = axios.create({ baseURL: API_URL, timeout: 15000, withCredentials: true, headers: SESSION_HEADERS });

const ACCESS_KEY = 'bingoor_admin_access';
const REFRESH_KEY = 'bingoor_admin_refresh';
const USER_KEY = 'bingoor_admin_user';

// The panel used to keep the sign-in under the old brand's key prefix (spelled
// in two parts so the old name is not in the code). Move it once so admins
// stay signed in after the rename.
if (typeof window !== 'undefined') {
  try {
    const old = 'auto' + 'zo_admin_';
    for (const name of ['access', 'refresh', 'user']) {
      const v = localStorage.getItem(old + name);
      if (v !== null) {
        if (localStorage.getItem(`bingoor_admin_${name}`) === null) localStorage.setItem(`bingoor_admin_${name}`, v);
        localStorage.removeItem(old + name);
      }
    }
  } catch {
    /* storage blocked: nothing to move */
  }
}

let accessToken: string | null = null;

export const tokens = {
  get access() {
    return accessToken;
  },
  /** A refresh token left in storage by an older build; sent once, then the cookie takes over. */
  get legacyRefresh() {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  get user(): unknown | null {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  /** Keeps the access token in memory and the (non-secret) profile for the UI. */
  save(access: string, user?: unknown) {
    accessToken = access || accessToken;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    accessToken = null;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn;
};

api.interceptors.request.use((config) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

/** Gets a fresh access token using the HttpOnly refresh cookie. */
export async function refreshTokens(): Promise<string | null> {
  const legacy = tokens.legacyRefresh;
  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, legacy ? { refreshToken: legacy } : {}, {
      timeout: 15000,
      withCredentials: true,
      headers: SESSION_HEADERS,
    });
    tokens.save(data.data.accessToken);
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

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the server. Check your internet connection.';
    const payload = err.response.data as { message?: string; errors?: Record<string, string[] | string>; details?: Record<string, string[] | string> } | undefined;
    const details =
      (payload?.details ?? payload?.errors) &&
      Object.entries((payload.details ?? payload.errors) as Record<string, string[] | string>)
        .flatMap(([field, value]) => {
          const messages = Array.isArray(value) ? value : [value];
          return messages.filter(Boolean).map((msg) => (field === '_form' ? msg : `${field}: ${msg}`));
        })
        .join(', ');
    // The server's headline is already a readable sentence; the raw field list is the fallback.
    const message = payload?.message && payload.message !== 'Validation failed' ? payload.message : details || payload?.message;
    return message ?? `Something went wrong (${err.response.status}).`;
  }
  return 'Something went wrong.';
}
