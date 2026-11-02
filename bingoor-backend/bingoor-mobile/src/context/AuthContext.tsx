import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchRiderMe, logoutRequest, riderLoginRequest } from '../api/auth';
import axios from 'axios';
import { setAccessToken, setSessionExpiredHandler } from '../api/client';
import { tokenStore } from '../storage/tokens';
import { User } from '../types';

interface AuthContextValue { user: User | null; initializing: boolean; offline: boolean; retry: () => void; signInRider: (identifier: string, password: string) => Promise<void>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setOffline(false); setInitializing(true); setAttempt((n) => n + 1); }, []);
  useEffect(() => {
    let cancelled = false;
    setSessionExpiredHandler(() => setUser(null));
    (async () => {
      try {
        const [access, refresh] = await Promise.all([tokenStore.getAccess(), tokenStore.getRefresh()]);
        if (!access && !refresh) return;
        setAccessToken(access);
        const rider = await fetchRiderMe();
        if (!cancelled && rider.role === 'rider') setUser(rider);
        else { await tokenStore.clear(); setAccessToken(null); }
      } catch (err) {
        // No network / server down on a weak signal: keep the saved login and offer a retry,
        // instead of signing the rider out every time the app opens without internet.
        if (axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) { if (!cancelled) setOffline(true); }
        else { setAccessToken(null); await tokenStore.clear(); }
      }
      finally { if (!cancelled) setInitializing(false); }
    })();
    return () => { cancelled = true; setSessionExpiredHandler(null); };
  }, [attempt]);

  const signInRider = useCallback(async (identifier: string, password: string) => {
    const result = await riderLoginRequest(identifier, password);
    // A phone whose secure storage refuses the tokens still signs in, just for this session.
    await tokenStore.save(result.accessToken, result.refreshToken).catch(() => undefined);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);
  const signOut = useCallback(async () => {
    try { await logoutRequest(await tokenStore.getRefresh()); } catch { /* server unreachable */ }
    await tokenStore.clear(); setAccessToken(null); setUser(null);
  }, []);
  const value = useMemo(() => ({ user, initializing, offline, retry, signInRider, signOut }), [user, initializing, offline, retry, signInRider, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>'); return ctx; }