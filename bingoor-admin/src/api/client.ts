import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

const ACCESS_KEY = 'autozo_admin_access';
const REFRESH_KEY = 'autozo_admin_refresh';
const USER_KEY = 'autozo_admin_user';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  get user(): unknown | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(access: string, refresh: string, user?: unknown) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
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
