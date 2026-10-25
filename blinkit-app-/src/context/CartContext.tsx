import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as cartApi from '../api/cart';
import { getErrorMessage } from '../api/client';
import { CartView } from '../types';
import { useToast } from '../ui/Toast';
import { localStore } from '../storage/tokens';
import { deliveryPointParams } from '../store/deliveryPoint';
import { useAuth } from './AuthContext';

/*
 * #23: a visitor without an account can fill a cart too. Their items live on
 * the phone and are priced by the server (POST /cart/guest); when they sign in
 * the items move into their account's cart.
 */
type GuestItem = { productId: string; quantity: number };
const MAX_QTY = 20;

async function readGuest(): Promise<GuestItem[]> {
  try {
    const raw = JSON.parse((await localStore.getGuestCart()) || '[]') as GuestItem[];
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.productId === 'string' && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeGuest(items: GuestItem[]) {
  localStore.setGuestCart(items.length ? JSON.stringify(items) : null).catch(() => undefined);
}

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
  const guestItems = useRef<GuestItem[]>([]);

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

  const priceGuest = useCallback(async () => {
    const items = guestItems.current;
    if (items.length === 0) return EMPTY;
    const view = await cartApi.fetchGuestCart(items, deliveryPointParams());
    // Products that no longer exist drop out of the stored basket too.
    const known = new Set(view.groups.flatMap((g) => g.items.map((i) => i.productId)));
    if (items.some((i) => !known.has(i.productId))) {
      guestItems.current = items.filter((i) => known.has(i.productId));
      writeGuest(guestItems.current);
    }
    return view;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        guestItems.current = await readGuest();
        const next = await priceGuest();
        if (mounted.current) setCart(next);
        return;
      }
      // Just signed in with things in the basket: move them into the account's cart.
      const waiting = await readGuest();
      if (waiting.length) {
        for (const i of waiting) await cartApi.addCartItem(i.productId, i.quantity).catch(() => undefined);
        guestItems.current = [];
        writeGuest([]);
      }
      const next = await cartApi.fetchCart();
      if (mounted.current) setCart(next);
    } catch {
      // A failed refresh should not wipe a cart the user can still see
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user, priceGuest]);

  // Load on sign-in, and the visitor's own basket when signed out
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Changes the visitor's basket and re-prices it; mirrors what the cart endpoints return. */
  const guestChange = useCallback(
    (productId: string, quantity: number | ((current: number) => number)) => async (): Promise<CartView> => {
      const before = guestItems.current;
      const current = before.find((i) => i.productId === productId)?.quantity ?? 0;
      const wanted = Math.min(MAX_QTY, Math.max(0, typeof quantity === 'function' ? quantity(current) : quantity));
      const next = before.filter((i) => i.productId !== productId);
      if (wanted > 0) next.push({ productId, quantity: wanted });
      guestItems.current = next;
      try {
        const view = await priceGuest();
        writeGuest(guestItems.current);
        return view;
      } catch (err) {
        guestItems.current = before;
        throw err;
      }
    },
    [priceGuest],
  );

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
      run(
        productId,
        user ? () => cartApi.addCartItem(productId, quantity) : guestChange(productId, (q) => q + quantity),
        productName ? `${productName} added to cart` : 'Added to cart',
      ),
    [run, user, guestChange],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      run(productId, user ? () => cartApi.setCartItemQuantity(productId, quantity) : guestChange(productId, quantity)),
    [run, user, guestChange],
  );

  const remove = useCallback(
    (productId: string) => run(productId, user ? () => cartApi.removeCartItem(productId) : guestChange(productId, 0), 'Removed from cart'),
    [run, user, guestChange],
  );

  const clear = useCallback(async () => {
    try {
      if (!user) {
        guestItems.current = [];
        writeGuest([]);
        setCart(EMPTY);
        return;
      }
      setCart(await cartApi.clearCart());
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [toast, user]);

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
