'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SlotKey } from '../lib/types';
import { useSettings } from './SettingsContext';

const KEY = 'autozo_slot';

const FALLBACK: { key: SlotKey; label: string }[] = [
  { key: 'instant', label: '19 minutes' },
  { key: 'twoHour', label: '2 hours' },
  { key: 'nextDay', label: 'Next day delivery' },
];

interface SlotApi {
  /** The times the admin left on, in order. A hidden time is simply absent. */
  slots: { key: SlotKey; label: string }[];
  slot: SlotKey;
  setSlot: (key: SlotKey) => void;
  label: string;
}

const SlotContext = createContext<SlotApi>({ slots: FALLBACK, slot: 'instant', setSlot: () => undefined, label: '19 minutes' });

/** Which delivery time the customer picked - shared by the home page, the cart and checkout. */
export function SlotProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const slots = settings?.deliverySlots?.length ? settings.deliverySlots : FALLBACK;
  const [picked, setPicked] = useState<SlotKey | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'instant' || saved === 'twoHour' || saved === 'nextDay') setPicked(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // A saved choice the admin has since hidden falls back to the first time on offer.
  const slot = picked && slots.some((s) => s.key === picked) ? picked : slots[0].key;

  const setSlot = useCallback((key: SlotKey) => {
    setPicked(key);
    try {
      localStorage.setItem(KEY, key);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ slots, slot, setSlot, label: slots.find((s) => s.key === slot)?.label ?? '' }),
    [slots, slot, setSlot],
  );
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

export const useSlot = (): SlotApi => useContext(SlotContext);
