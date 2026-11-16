'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addToWishlist, fetchWishlist, removeFromWishlist } from '../api/account';
import { useAuth } from './AuthContext';

interface WishlistApi {
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  /** How many products are saved, for the header heart's badge. */
  count: number;
}

const WishlistContext = createContext<WishlistApi | undefined>(undefined);

/** The ids of the signed-in customer's saved products, so every card can show a filled heart. */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let live = true;
    fetchWishlist()
      .then((items) => live && setIds(new Set(items.map((p) => p.id))))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user]);

  const toggle = useCallback(
    async (productId: string) => {
      const was = ids.has(productId);
      // A short buzz on phones that support it, like the ADD button.
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
      // Optimistic: the heart flips at once and goes back if the server says no.
      setIds((cur) => {
        const next = new Set(cur);
        if (was) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        if (was) await removeFromWishlist(productId);
        else await addToWishlist(productId);
      } catch (e) {
        setIds((cur) => {
          const next = new Set(cur);
          if (was) next.add(productId);
          else next.delete(productId);
          return next;
        });
        throw e;
      }
    },
    [ids],
  );

  const value = useMemo<WishlistApi>(() => ({ has: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistApi {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
