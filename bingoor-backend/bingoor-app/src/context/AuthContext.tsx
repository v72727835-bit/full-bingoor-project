import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, loginRequest, logoutRequest, registerRequest, RegisterInput } from '../api/auth';
import { setAccessToken, setSessionExpiredHandler } from '../api/client';
import { tokenStore } from '../storage/tokens';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  /** true while we check for a saved session at app start */
  initializing: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

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

  const value = useMemo(
    () => ({ user, initializing, signIn, signUp, signOut }),
    [user, initializing, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
