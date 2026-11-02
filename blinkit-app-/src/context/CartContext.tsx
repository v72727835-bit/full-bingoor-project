import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as cartApi from '../api/cart';
import { getErrorMessage } from '../api/client';
import { CartView } from '../types';
import { useToast } from '../ui/Toast';
import { useAuth } from './AuthContext';

const EMPTY: CartView = {
  groups: [],
  itemCount: 0,
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
  hasIssues: false,
  freeDeliveryAbove: 499,
};

interface CartApi {
  cart: CartView;
  loading: boolean;
  /** Product ids currently mid-request, so each row can show its own spinner. */
  pending: Set<string>;
  refresh: () => Promise<void>;
  quantityOf: (productId: string) => number;
  add: (productId: string, quantity?: number, productName?: string) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  /** Replaces local state after checkout or reorder without another round trip. */
  applyCart: (next: CartView) => void;
}

const CartContext = createContext<CartApi | undefined>(undefined);

/**
 * Single owner of cart state.
 *
 * Every screen reads quantities from here rather than keeping its own copy,
 * so the tab badge, the product card stepper and the cart page can never
 * disagree about what is in the basket.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState<CartView>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mark = useCallback((productId: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(EMPTY);
      return;
    }
    setLoading(true);
    try {
      const next = await cartApi.fetchCart();
      if (mounted.current) setCart(next);
    } catch {
      // A failed refresh should not wipe a cart the user can still see
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  // Load on sign-in, drop on sign-out
  useEffect(() => {
    if (user) void refresh();
    else setCart(EMPTY);
  }, [user, refresh]);

  const run = useCallback(
    async (productId: string, fn: () => Promise<CartView>, successMessage?: string) => {
      mark(productId, true);
      try {
        const next = await fn();
        if (mounted.current) setCart(next);
        if (next.notice) toast.show(next.notice);
        else if (successMessage) toast.success(successMessage);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        if (mounted.current) mark(productId, false);
      }
    },
    [mark, toast],
  );

  const quantityOf = useCallback(
    (productId: string) => {
      for (const group of cart.groups) {
        const line = group.items.find((i) => i.productId === productId);
        if (line) return line.quantity;
      }
      return 0;
    },
    [cart],
  );

  const add = useCallback(
    (productId: string, quantity = 1, productName?: string) =>
      run(productId, () => cartApi.addCartItem(productId, quantity), productName ? `${productName} added to cart` : 'Added to cart'),
    [run],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => run(productId, () => cartApi.setCartItemQuantity(productId, quantity)),
    [run],
  );

  const remove = useCallback(
    (productId: string) => run(productId, () => cartApi.removeCartItem(productId), 'Removed from cart'),
    [run],
  );

  const clear = useCallback(async () => {
    try {
      setCart(await cartApi.clearCart());
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [toast]);

  const value = useMemo<CartApi>(
    () => ({ cart, loading, pending, refresh, quantityOf, add, setQuantity, remove, clear, applyCart: setCart }),
    [cart, loading, pending, refresh, quantityOf, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
