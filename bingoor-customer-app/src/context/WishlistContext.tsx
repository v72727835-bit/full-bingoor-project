import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../api/client';
import * as userApi from '../api/user';
import { ProductSummary } from '../types';
import { useToast } from '../ui/Toast';
import { tapAdd } from '../utils/haptics';
import { useAuth } from './AuthContext';

interface WishlistApi {
  items: ProductSummary[];
  ids: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
  isSaved: (productId: string) => boolean;
  toggle: (product: Pick<ProductSummary, '_id' | 'name'>) => Promise<void>;
}

const WishlistContext = createContext<WishlistApi | undefined>(undefined);

/**
 * Wishlist state shared by the heart button on every card and the Saved page.
 * The toggle updates locally first so the heart fills instantly, then reverts
 * if the server rejects it.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const list = await userApi.fetchWishlist();
      setItems(list);
      setIds(new Set(list.map((p) => p._id)));
    } catch {
      // Silent - a wishlist that fails to load is not worth interrupting for
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isSaved = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(
    async (product: Pick<ProductSummary, '_id' | 'name'>) => {
      const saved = ids.has(product._id);
      tapAdd(); // the same short buzz as ADD, on save and on remove
      setIds((prev) => {
        const next = new Set(prev);
        if (saved) next.delete(product._id);
        else next.add(product._id);
        return next;
      });

      try {
        if (saved) {
          await userApi.removeFromWishlist(product._id);
          setItems((prev) => prev.filter((p) => p._id !== product._id));
          toast.success('Product is removed from wish list');
        } else {
          await userApi.addToWishlist(product._id);
          toast.success('Product is added to wish list');
          void refresh();
        }
      } catch (err) {
        setIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(product._id);
          else next.delete(product._id);
          return next;
        });
        toast.error(getErrorMessage(err));
      }
    },
    [ids, refresh, toast],
  );

  const value = useMemo<WishlistApi>(
    () => ({ items, ids, loading, refresh, isSaved, toggle }),
    [items, ids, loading, refresh, isSaved, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistApi {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}
