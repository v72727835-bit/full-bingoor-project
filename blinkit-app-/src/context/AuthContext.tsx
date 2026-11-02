import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, loginRequest, logoutRequest, registerRequest, RegisterInput, socialLoginRequest } from '../api/auth';
import { setAccessToken, setSessionExpiredHandler } from '../api/client';
import { setDeliveryPoint, syncPointFromAddresses } from '../store/deliveryPoint';
import { tokenStore } from '../storage/tokens';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  /** true while we check for a saved session at app start */
  initializing: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  /** Set right after sign-up so the customer sees the login details they just created. */
  welcome: { phone: string; password: string } | null;
  dismissWelcome: () => void;
  signInSocial: (provider: 'google' | 'facebook', accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Push a freshly-saved profile into context without a round trip. */
  applyUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [welcome, setWelcome] = useState<{ phone: string; password: string } | null>(null);

  // Restore a saved session (the API client refreshes an expired access token by itself)
  useEffect(() => {
    let cancelled = false;

    setSessionExpiredHandler(() => setUser(null));

    (async () => {
      try {
        const [access, refresh] = await Promise.all([tokenStore.getAccess(), tokenStore.getRefresh()]);
        if (!access && !refresh) return;
        setAccessToken(access);
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch {
        // Offline or session gone - user simply sees the login screen
        setAccessToken(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const result = await loginRequest(identifier, password);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const signUp = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setWelcome({ phone: input.phone, password: input.password });
    setUser(result.user);
  }, []);

  const dismissWelcome = useCallback(() => setWelcome(null), []);

  const signInSocial = useCallback(async (provider: 'google' | 'facebook', accessToken: string) => {
    const result = await socialLoginRequest(provider, accessToken);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest(await tokenStore.getRefresh());
    } catch {
      /* server unreachable - still log out locally */
    }
    await tokenStore.clear();
    setAccessToken(null);
    setUser(null);
  }, []);

  const applyUser = useCallback((next: User) => setUser(next), []);

  // Scope the catalogue to the signed-in customer's default address pin.
  useEffect(() => {
    if (user) syncPointFromAddresses(user.addresses);
    else setDeliveryPoint(null);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchMe());
    } catch {
      /* keep the cached profile if the refresh fails */
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, signIn, signUp, welcome, dismissWelcome, signInSocial, signOut, applyUser, refreshUser }),
    [user, initializing, signIn, signUp, welcome, dismissWelcome, signInSocial, signOut, applyUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
