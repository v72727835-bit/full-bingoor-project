'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as cartApi from '../api/cart';
import { getDeliveryPoint, POINT_EVENT } from '../lib/deliveryPoint';
import { optimisticQuantity } from '../lib/optimisticCart';
import { CartView, Product } from '../lib/types';
import { useAuth } from './AuthContext';
import { useSlot } from './SlotContext';

interface CartApi {
  cart: CartView | null;
  loading: boolean;
  /** True while the basket belongs to a visitor who has not signed in (it lives in this browser). */
  guest: boolean;
  /** Quantity of one product across every shop group, for card steppers. */
  quantityOf: (productId: string) => number;
  refresh: () => Promise<void>;
  settle: () => Promise<void>;
  addItem: (productId: string, quantity?: number, product?: Product) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartApi | undefined>(undefined);

/*
 * #23: anyone can fill a cart without an account. The visitor's items are kept
 * in localStorage and priced by the server (POST /cart/guest); the moment they
 * sign in, the items move into their real cart and the local copy is emptied.
 */
type GuestItem = { productId: string; quantity: number };
const GUEST_KEY = 'bingoor_guest_cart';
const MAX_QTY = 20;

function readGuest(): GuestItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]') as GuestItem[];
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.productId === 'string' && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeGuest(items: GuestItem[]) {
  try {
    if (items.length) localStorage.setItem(GUEST_KEY, JSON.stringify(items));
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    /* storage blocked - the basket lasts for this page only */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { slot } = useSlot();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);
  const guestItems = useRef<GuestItem[]>([]);
  const confirmed = useRef<CartView | null>(null);
  const serial = useRef(Promise.resolve());
  const operations = useRef<{ id: number; apply: (view: CartView) => CartView }[]>([]);
  const epoch = useRef(0);
  const counter = useRef(0);
  const empty: CartView = { groups: [], itemCount: 0, subtotal: 0, deliveryFee: 0, total: 0,
    hasIssues: false, freeDeliveryAbove: 499, points: { enabled: false, met: true, suggestions: [], autoAddId: null } };
  const publish = () => setCart(operations.current.reduce((view, op) => op.apply(view), confirmed.current ?? empty));
  const commit = (view: CartView | null, session = epoch.current) => {
    if (session !== epoch.current) return;
    confirmed.current = view; publish();
  };
  const enqueue = (apply: (view: CartView) => CartView, request: (session: number) => Promise<void>) => {
    const op = { id: ++counter.current, apply };
    const session = epoch.current;
    operations.current.push(op); publish();
    const task = serial.current.then(async () => {
      if (session !== epoch.current) return;
      try { await request(session); }
      finally {
        if (session === epoch.current) {
          operations.current = operations.current.filter((item) => item.id !== op.id);
          publish();
        }
      }
    });
    serial.current = task.catch(() => undefined);
    return task;
  };

  const priceGuest = useCallback(async () => {
    const session = epoch.current;
    const items = guestItems.current;
    if (items.length === 0) {
      commit(null);
      return;
    }
    const point = getDeliveryPoint();
    const view = await cartApi.fetchGuestCart({ items, slot, ...(point ? { lat: point.lat, lng: point.lng } : {}) });
    // Products that no longer exist drop out of the stored basket too.
    const known = new Set(view.groups.flatMap((g) => g.items.map((i) => i.productId)));
    const kept = items.filter((i) => known.has(i.productId));
    if (kept.length !== items.length) {
      guestItems.current = kept;
      writeGuest(kept);
    }
    commit(view, session);
  }, [slot]);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    const session = epoch.current;
    await serial.current;
    if (session !== epoch.current) return;
    setLoading(true);
    try {
      if (!user) {
        guestItems.current = readGuest();
        await priceGuest();
        return;
      }
      // Just signed in with things in the basket: move them into the account's cart.
      const pending = readGuest();
      if (pending.length) {
        for (const i of pending) await cartApi.addCartItem(i.productId, i.quantity).catch(() => undefined);
        writeGuest([]);
        guestItems.current = [];
      }
      const revision = counter.current;
      const next = await cartApi.fetchCart();
      if (revision === counter.current) commit(next, session);
    } catch {
      /* a failed read shouldn't blank a cart the user can still see */
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading, priceGuest]);

  useEffect(() => {
    epoch.current++;
    operations.current = [];
    confirmed.current = null;
    setCart(null);
    serial.current = refresh();
  }, [refresh]);

  // A visitor's delivery fee depends on where they are, so re-price when the location changes.
  useEffect(() => {
    if (user) return;
    const onPoint = () => { serial.current = serial.current.then(() => priceGuest()).catch(() => undefined); };
    window.addEventListener(POINT_EVENT, onPoint);
    return () => window.removeEventListener(POINT_EVENT, onPoint);
  }, [user, priceGuest]);

  /** Flat productId -> quantity map; rails render dozens of cards at once. */
  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    cart?.groups.forEach((g) =>
      g.items.forEach((i) => map.set(i.productId, (map.get(i.productId) ?? 0) + i.quantity)),
    );
    return map;
  }, [cart]);

  const quantityOf = useCallback((productId: string) => quantities.get(productId) ?? 0, [quantities]);

  const setGuest = async (next: GuestItem[]) => {
    const before = guestItems.current;
    guestItems.current = next;
    try {
      await priceGuest();
      writeGuest(guestItems.current);
    } catch (e) {
      guestItems.current = before;
      throw e;
    }
  };

  const addItem = (productId: string, quantity = 1, product?: Product) => enqueue((view) => {
    const current = view.groups.flatMap((g) => g.items).find((i) => i.productId === productId)?.quantity ?? 0;
    return optimisticQuantity(view, productId, current + quantity, product);
  }, async (session) => {
    if (user) { commit(await cartApi.addCartItem(productId, quantity), session); return; }
    const items = guestItems.current.map((i) => ({ ...i }));
    const found = items.find((i) => i.productId === productId);
    if (found) found.quantity = Math.min(MAX_QTY, found.quantity + quantity);
    else items.push({ productId, quantity: Math.min(MAX_QTY, quantity) });
    await setGuest(items);
  });
  const updateItem = (productId: string, quantity: number) => enqueue(
    (view) => optimisticQuantity(view, productId, quantity), async (session) => {
      if (user) {
        commit(await (quantity <= 0 ? cartApi.removeCartItem(productId) : cartApi.updateCartItem(productId, quantity)), session);
        return;
      }
      await setGuest(guestItems.current.map((i) => i.productId === productId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i).filter((i) => i.quantity > 0));
    });
  const removeItem = (productId: string) => updateItem(productId, 0);
  const clear = () => enqueue(() => empty, async (session) => {
    if (user) commit(await cartApi.clearCart(), session);
    else await setGuest([]);
  });

  return (
    <CartContext.Provider value={{ cart, loading, guest: !user, quantityOf, refresh, settle: async () => { await serial.current; }, addItem, updateItem, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
