import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config';
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
  } catch (err) {
    // No network is not a dead session: fail this request but keep the saved login.
    if (axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) throw err;
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
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return err.code === 'ECONNABORTED'
        ? 'The server took too long to respond. Please try again.'
        : 'Cannot reach the server. Check your internet connection and the API URL.';
    }
    const message = (err.response.data as { message?: string } | undefined)?.message;
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
