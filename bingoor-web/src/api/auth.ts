import { api, tokens } from '../lib/client';
import { UserProfile } from '../lib/types';

export const register = async (name: string, phone: string, password: string, email?: string) => {
  const { data } = await api.post('/auth/register', { name, phone, password, email });
  tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user as UserProfile;
};

export const login = async (identifier: string, password: string) => {
  const { data } = await api.post('/auth/login', { identifier, password });
  tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user as UserProfile;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout', { refreshToken: tokens.refresh });
  } catch {
    /* ignore */
  }
  tokens.clear();
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  await api.post('/auth/change-password', { currentPassword, newPassword });
};

/** Continue with Google / Facebook: the server checks the token with the provider and signs the customer in. */
export const socialLogin = async (provider: 'google' | 'facebook', accessToken: string) => {
  const { data } = await api.post(`/auth/${provider}`, { accessToken });
  tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user as UserProfile;
};

/** Continue with Instagram: the server swaps Instagram's one-time code for the customer's Instagram id. */
export const instagramLogin = async (code: string, redirectUri: string) => {
  const { data } = await api.post('/auth/instagram', { code, redirectUri });
  tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user as UserProfile;
};
