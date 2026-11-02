import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { logoutRequest, sellerLogin, sellerMe } from '../api/seller';
import { setAccessToken, setSessionExpiredHandler } from '../api/client';
import { tokenStore } from '../storage/tokens';
import { Me } from '../types';

interface Ctx { me: Me | null; initializing: boolean; signIn: (identifier: string, password: string) => Promise<void>; signOut: () => Promise<void>; reload: () => Promise<void> }
const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSessionExpiredHandler(() => setMe(null));
    (async () => {
      try {
        const [access, refresh] = await Promise.all([tokenStore.getAccess(), tokenStore.getRefresh()]);
        if (!access && !refresh) return;
        setAccessToken(access);
        const m = await sellerMe();
        if (!cancelled) setMe(m);
      } catch {
        setAccessToken(null);
        await tokenStore.clear();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; setSessionExpiredHandler(null); };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const r = await sellerLogin(identifier, password);
    await tokenStore.save(r.accessToken, r.refreshToken);
    setAccessToken(r.accessToken);
    setMe(await sellerMe());
  }, []);
  const signOut = useCallback(async () => {
    try { await logoutRequest(await tokenStore.getRefresh()); } catch { /* server unreachable */ }
    await tokenStore.clear();
    setAccessToken(null);
    setMe(null);
  }, []);
  const reload = useCallback(async () => { setMe(await sellerMe()); }, []);
  const value = useMemo(() => ({ me, initializing, signIn, signOut, reload }), [me, initializing, signIn, signOut, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
