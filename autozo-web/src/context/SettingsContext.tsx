'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchPublicSettings } from '../api/catalog';
import { setGeoMaps } from '../lib/geo';
import { PublicSettings } from '../lib/types';

/**
 * Shop-wide switches the admin controls: whether the festival tab is live and
 * what it is called, the app store links in the footer, and the cash-on-
 * delivery note. Fetched once and shared, because the header, the bottom nav
 * and the footer all read from it.
 */
const SettingsContext = createContext<PublicSettings | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetchPublicSettings()
      .then((next) => {
        // Address lookups use Google when the admin saved a Maps key (point 16).
        setGeoMaps(next?.maps);
        setSettings(next);
      })
      .catch(() => undefined); // The storefront works fine without them.
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): PublicSettings | null {
  return useContext(SettingsContext);
}
