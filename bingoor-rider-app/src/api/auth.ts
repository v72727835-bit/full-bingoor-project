import { ApiEnvelope, AuthResult, User } from '../types';
import { api } from './client';

export async function loginRequest(identifier: string, password: string): Promise<AuthResult> {
  const { data } = await api.post<ApiEnvelope<AuthResult>>('/auth/login', { identifier, password });
  return data.data;
}

export interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
}

export async function riderLoginRequest(identifier: string, password: string): Promise<AuthResult> {
  const { data } = await api.post<ApiEnvelope<AuthResult>>('/rider/auth/login', { identifier, password });
  return data.data;
}
export async function registerRequest(input: RegisterInput): Promise<AuthResult> {
  const { data } = await api.post<ApiEnvelope<AuthResult>>('/auth/register', input);
  return data.data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<ApiEnvelope<User>>('/me');
  return data.data;
}

export async function logoutRequest(refreshToken: string | null): Promise<void> {
  await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
}

export async function fetchRiderMe(): Promise<User> {
  const { data } = await api.get<ApiEnvelope<User>>('/rider/me');
  return data.data;
}
