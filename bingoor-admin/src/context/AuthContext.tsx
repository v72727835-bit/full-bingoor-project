"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getErrorMessage, refreshTokens, setSessionExpiredHandler, tokens } from '../api/client';
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
    // The profile is cached for the UI; the session itself is the HttpOnly
    // refresh cookie, so a page reload trades it for a new in-memory access token.
    let cancelled = false;
    const cached = tokens.user as AdminUser | null;
    if (!cached) {
      setLoading(false);
    } else {
      void refreshTokens().then((access) => {
        if (cancelled) return;
        if (access) setUser(cached);
        else tokens.clear();
        setLoading(false);
      });
    }
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, []);

  const login = async (identifier: string, password: string, asSeller = false) => {
    try {
      const { data } = await api.post(asSeller ? '/seller/auth/login' : '/admin/auth/login', { identifier, password });
      tokens.save(data.data.accessToken, data.data.user);
      setUser(data.data.user);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const logout = () => {
    // Ends this session on the server and clears the refresh cookie.
    if (tokens.access) void api.post('/auth/logout', {}).catch(() => undefined);
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
