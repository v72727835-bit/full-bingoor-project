import { api, tokens } from '../lib/client';
import { unregisterPush } from '../components/PushRegister';
import { UserProfile } from '../lib/types';

export const register = async (name: string, phone: string, password: string, email?: string, firebaseIdToken?: string) => {
  const { data } = await api.post('/auth/register', { name, phone, password, email, firebaseIdToken });
  tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user as UserProfile;
};

export const login = async (identifier: string, password: string, firebaseIdToken?: string) => {
  const { data } = await api.post('/auth/login', { identifier, password, firebaseIdToken });
  tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user as UserProfile;
};

export const logout = async () => {
  await unregisterPush();
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

/** Forgot password: the verified phone OTP token lets the customer set a new password. */
export const resetPassword = async (phone: string, newPassword: string, firebaseIdToken: string) => {
  await api.post('/auth/reset-password', { phone, newPassword, firebaseIdToken });
};
