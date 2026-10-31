import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchStats } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { DashboardStats } from '../types';

interface StatsApi {
  stats: DashboardStats | null;
  error: string;
  loading: boolean;
  days: number;
  setDays: (d: number) => void;
  refresh: () => void;
  lastUpdated: Date | null;
}

const StatsContext = createContext<StatsApi | undefined>(undefined);

/** One shared stats poll feeds the dashboard, the sidebar badges and the bell. */
export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(
    (d: number) => {
      if (inFlight.current) return;
      inFlight.current = true;
      fetchStats(d)
        .then((s) => {
          setStats(s);
          setError('');
          setLastUpdated(new Date());
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => {
          inFlight.current = false;
          setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    load(days);
    const timer = setInterval(() => load(days), 60_000);
    const onFocus = () => load(days);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [days, load]);

  return (
    <StatsContext.Provider
      value={{ stats, error, loading, days, setDays, refresh: () => load(days), lastUpdated }}
    >
      {children}
    </StatsContext.Provider>
  );
}

export function useStats(): StatsApi {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error('useStats must be used inside <StatsProvider>');
  return ctx;
}

/** Orders that still need someone to act on them. */
export function activeOrderCount(stats: DashboardStats | null): number {
  if (!stats) return 0;
  const s = stats.orders.byStatus;
  return (s.placed ?? 0) + (s.accepted ?? 0) + (s.preparing ?? 0) + (s.ready_for_pickup ?? 0) + (s.out_for_delivery ?? 0);
}
