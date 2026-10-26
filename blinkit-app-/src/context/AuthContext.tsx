import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, loginRequest, logoutRequest, registerRequest, RegisterInput, socialLoginRequest } from '../api/auth';
import { unregisterPush } from '../firebase/push';
import { isNetworkError, setAccessToken, setSessionExpiredHandler } from '../api/client';
import { setDeliveryPoint, syncPointFromAddresses } from '../store/deliveryPoint';
import { localStore, tokenStore } from '../storage/tokens';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  /** true while we check for a saved session at app start */
  initializing: boolean;
  signIn: (identifier: string, password: string, firebaseIdToken?: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  /** Set right after sign-up so the customer sees the login details they just created. */
  welcome: { phone: string; password: string } | null;
  dismissWelcome: () => void;
  signInSocial: (provider: 'google' | 'facebook', accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Push a freshly-saved profile into context without a round trip. */
  applyUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  /** A visitor looking around without an account (#23): they can browse and fill a cart, and sign in at payment. */
  guest: boolean;
  browseAsGuest: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [welcome, setWelcome] = useState<{ phone: string; password: string } | null>(null);
  const [guest, setGuest] = useState(false);

  // Restore a saved session (the API client refreshes an expired access token by itself)
  useEffect(() => {
    let cancelled = false;

    // A genuine auth failure clears the saved profile too; a network blip must not.
    setSessionExpiredHandler(() => {
      setUser(null);
      void localStore.setUser(null);
    });

    (async () => {
      try {
        const [access, refresh, wasGuest] = await Promise.all([tokenStore.getAccess(), tokenStore.getRefresh(), localStore.getGuest()]);
        if (!cancelled && wasGuest) setGuest(true);
        if (!access && !refresh) return;
        setAccessToken(access);
        const me = await fetchMe();
        if (!cancelled) setUser(me);
        void localStore.setUser(JSON.stringify(me));
      } catch (err) {
        // F-05: don't discard a valid session on a transient network error /
        // backend cold start. Only a real auth failure (handled by the API
        // client's 401 path, which clears the tokens) should log the user out.
        // On a network error, keep the stored tokens and restore the last known
        // profile so the customer stays signed in; a later request refreshes it.
        if (isNetworkError(err)) {
          const cached = await localStore.getUser();
          if (!cancelled && cached) {
            try {
              setUser(JSON.parse(cached) as User);
            } catch {
              /* ignore a corrupt cache */
            }
          }
        } else {
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, []);

  // Keep the on-device profile cache in step with context (used for offline restore).
  const rememberUser = useCallback((next: User) => {
    setUser(next);
    void localStore.setUser(JSON.stringify(next));
  }, []);

  const signIn = useCallback(async (identifier: string, password: string, firebaseIdToken?: string) => {
    const result = await loginRequest(identifier, password, firebaseIdToken);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    rememberUser(result.user);
  }, [rememberUser]);

  const signUp = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setWelcome({ phone: input.phone, password: input.password });
    rememberUser(result.user);
  }, [rememberUser]);

  const dismissWelcome = useCallback(() => setWelcome(null), []);

  const signInSocial = useCallback(async (provider: 'google' | 'facebook', accessToken: string) => {
    const result = await socialLoginRequest(provider, accessToken);
    await tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    rememberUser(result.user);
  }, [rememberUser]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    try {
      await logoutRequest(await tokenStore.getRefresh());
    } catch {
      /* server unreachable - still log out locally */
    }
    await tokenStore.clear();
    await localStore.setUser(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const applyUser = useCallback((next: User) => rememberUser(next), [rememberUser]);

  const browseAsGuest = useCallback(() => {
    setGuest(true);
    void localStore.setGuest(true);
  }, []);

  // Scope the catalogue to the signed-in customer's default address pin.
  useEffect(() => {
    if (user) syncPointFromAddresses(user.addresses);
    else setDeliveryPoint(null);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      rememberUser(await fetchMe());
    } catch {
      /* keep the cached profile if the refresh fails */
    }
  }, [rememberUser]);

  const value = useMemo(
    () => ({ user, initializing, signIn, signUp, welcome, dismissWelcome, signInSocial, signOut, applyUser, refreshUser, guest, browseAsGuest }),
    [user, initializing, signIn, signUp, welcome, dismissWelcome, signInSocial, signOut, applyUser, refreshUser, guest, browseAsGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
