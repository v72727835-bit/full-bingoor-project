import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { TabName } from './types';

interface TabsApi {
  active: TabName;
  goToTab: (name: TabName) => void;
}

const TabsContext = createContext<TabsApi | undefined>(undefined);
// goToTab never changes, so screens that only switch tabs read it from its own
// context and do not re-render on every tab switch (Home is the heaviest screen).
const GoToTabContext = createContext<((name: TabName) => void) | undefined>(undefined);

export interface TabScreenProps {
  /** True while this tab is the visible one - use it to refresh on entry. */
  active: boolean;
}

/**
 * Owns which tab is showing.
 *
 * It sits ABOVE the stack navigator, not inside the tab host, because pushed
 * screens like Checkout and Order placed also need to send the user to a tab
 * ("Continue shopping" -> Home). Keeping it inside MainTabs would make
 * useTabs() throw on every screen pushed on top of it.
 */
export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<TabName>('home');
  const goToTab = useCallback((name: TabName) => setActive(name), []);
  const value = useMemo(() => ({ active, goToTab }), [active, goToTab]);
  return (
    <GoToTabContext.Provider value={goToTab}>
      <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
    </GoToTabContext.Provider>
  );
}

/** Switches tabs without subscribing to which tab is showing. */
export function useGoToTab(): (name: TabName) => void {
  const go = useContext(GoToTabContext);
  if (!go) throw new Error('useGoToTab must be used inside <TabsProvider>');
  return go;
}

export function useTabs(): TabsApi {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used inside <TabsProvider>');
  return ctx;
}
