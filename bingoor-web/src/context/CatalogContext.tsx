'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchHome, homeLocationKey } from '../api/catalog';
import { POINT_EVENT } from '../lib/deliveryPoint';
import { getErrorMessage } from '../lib/client';
import { Home } from '../lib/types';

/**
 * The home payload carries the storefront's shape — delivery promise, the
 * top-level category tabs and every home section. Both the header and the
 * home page need it, so it is fetched once here and shared. Render's free
 * tier cold-starts, and a second identical request would double that wait.
 */
interface CatalogApi {
  home: Home | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

const CatalogContext = createContext<CatalogApi | undefined>(undefined);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const currentKey = useRef<string | null>(null);

  const load = useCallback(async (force = false) => {
    const version = ++request.current;
    const key = homeLocationKey();
    if (currentKey.current !== key) setHome(null);
    currentKey.current = key;
    setLoading(true);
    setError('');
    try {
      const result = await fetchHome(key, force);
      if (request.current === version) setHome(result);
    } catch (e) {
      if (request.current === version) setError(getErrorMessage(e));
    } finally {
      if (request.current === version) setLoading(false);
    }
  }, []);
  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    // A new delivery pin changes which shops (and so which products) apply.
    window.addEventListener(POINT_EVENT, refresh);
    window.addEventListener('online', refresh);
    return () => {
      request.current++;
      window.removeEventListener(POINT_EVENT, refresh);
      window.removeEventListener('online', refresh);
    };
  }, [load]);

  return <CatalogContext.Provider value={{ home, loading, error, reload }}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogApi {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return ctx;
}
