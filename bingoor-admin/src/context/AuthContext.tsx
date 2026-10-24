"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getErrorMessage, setSessionExpiredHandler, tokens } from '../api/client';
import { AdminUser } from '../types';

interface AuthApi {
  user: AdminUser | null;
  loading: boolean;
  login: (identifier: string, password: string, asSeller?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthApi | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    // The admin's profile came back with login and is cached alongside the
    // tokens, so a page refresh doesn't force a fresh sign-in.
    if (tokens.access && tokens.user) setUser(tokens.user as AdminUser);
    setLoading(false);
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = async (identifier: string, password: string, asSeller = false) => {
    try {
      const { data } = await api.post(asSeller ? '/seller/auth/login' : '/admin/auth/login', { identifier, password });
      tokens.save(data.data.accessToken, data.data.refreshToken, data.data.user);
      setUser(data.data.user);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const logout = () => {
    tokens.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
