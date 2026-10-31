'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { setSessionExpiredHandler, tokens } from '../lib/client';
import { UserProfile } from '../lib/types';
import * as authApi from '../api/auth';
import { fetchAddresses } from '../api/account';
import { setDeliveryPoint } from '../lib/deliveryPoint';

interface AuthApiShape {
  user: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string, firebaseIdToken?: string) => Promise<void>;
  register: (name: string, phone: string, password: string, email?: string, firebaseIdToken?: string) => Promise<void>;
  loginWithSocial: (provider: 'google' | 'facebook', accessToken: string) => Promise<void>;
  loginWithInstagram: (code: string, redirectUri: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: UserProfile | null) => void;
}

const AuthContext = createContext<AuthApiShape | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    if (tokens.access && tokens.user) setUser(tokens.user as UserProfile);
    setLoading(false);
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = async (identifier: string, password: string, firebaseIdToken?: string) => {
    const u = await authApi.login(identifier, password, firebaseIdToken);
    setUser(u);
  };

  const loginWithSocial = async (provider: 'google' | 'facebook', accessToken: string) => {
    setUser(await authApi.socialLogin(provider, accessToken));
  };

  const loginWithInstagram = async (code: string, redirectUri: string) => {
    setUser(await authApi.instagramLogin(code, redirectUri));
  };

  const register = async (name: string, phone: string, password: string, email?: string, firebaseIdToken?: string) => {
    const u = await authApi.register(name, phone, password, email, firebaseIdToken);
    setUser(u);
  };

  // Signed in: pick up the default address pin so the catalogue matches it.
  const userId = user?.id;
  useEffect(() => {
    if (userId) fetchAddresses().catch(() => undefined);
  }, [userId]);

  const logout = async () => {
    await authApi.logout();
    setDeliveryPoint(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithSocial, loginWithInstagram, logout, setUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthApiShape {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
