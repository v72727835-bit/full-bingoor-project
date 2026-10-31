import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchRiderMe, logoutRequest, riderLoginRequest } from '../api/auth';
import { unregisterPush } from '../firebase/push';
import { setAccessToken, setSessionExpiredHandler } from '../api/client';
import { tokenStore } from '../storage/tokens';
import { User } from '../types';

interface AuthContextValue { user: User | null; initializing: boolean; signInRider: (identifier: string, password: string, firebaseIdToken?: string) => Promise<void>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
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
      } catch { setAccessToken(null); await tokenStore.clear(); }
      finally { if (!cancelled) setInitializing(false); }
    })();
    return () => { cancelled = true; setSessionExpiredHandler(null); };
  }, []);

  const signInRider = useCallback(async (identifier: string, password: string, firebaseIdToken?: string) => {
    const result = await riderLoginRequest(identifier, password, firebaseIdToken);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);
  const signOut = useCallback(async () => {
    await unregisterPush();
    try { await logoutRequest(await tokenStore.getRefresh()); } catch { /* server unreachable */ }
    await tokenStore.clear(); setAccessToken(null); setUser(null);
  }, []);
  const value = useMemo(() => ({ user, initializing, signInRider, signOut }), [user, initializing, signInRider, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>'); return ctx; }