import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as cartApi from '../api/cart';
import { getErrorMessage } from '../api/client';
import { CartView, ProductSummary } from '../types';
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
  /** Product ids awaiting server confirmation; quantity controls stay interactive. */
  pending: Set<string>;
  /** `silent`: re-check without the pull-to-refresh spinner (on entering the cart tab). */
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  settle: () => Promise<void>;
  quantityOf: (productId: string) => number;
  add: (productId: string, quantity?: number, productName?: string, product?: ProductSummary) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  /** Replaces local state after checkout or reorder without another round trip. */
  applyCart: (next: CartView) => void;
}

const CartContext = createContext<CartApi | undefined>(undefined);

/**
 * Per-product quantities as a tiny external store. A product card reads only its
 * own quantity from here, so adding one item re-renders that card (and the cart
 * badge) instead of every card on a long list.
 */
function createQtyStore() {
  let qty = new Map<string, number>();
  const listeners = new Set<() => void>();
  return {
    get: (id: string) => qty.get(id) ?? 0,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    update(view: CartView) {
      const next = new Map<string, number>();
      for (const group of view.groups) for (const item of group.items) next.set(item.productId, item.quantity);
      let changed = next.size !== qty.size;
      if (!changed) for (const [id, n] of next) if (qty.get(id) !== n) { changed = true; break; }
      qty = next;
      if (changed) listeners.forEach((l) => l());
    },
  };
}
type QtyStore = ReturnType<typeof createQtyStore>;

/** The cart actions never change identity, so a component that only adds items never re-renders for cart changes. */
interface CartActions {
  add: CartApi['add'];
  setQuantity: CartApi['setQuantity'];
  remove: CartApi['remove'];
  qtyStore: QtyStore;
}
const CartActionsContext = createContext<CartActions | undefined>(undefined);

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
  const qtyStore = useRef<QtyStore>(createQtyStore()).current;
  const confirmed = useRef<CartView>(EMPTY);
  const operations = useRef<{ id: number; productId: string; apply: (cart: CartView) => CartView; request: () => Promise<CartView> }[]>([]);
  const serial = useRef(Promise.resolve());
  const epoch = useRef(0);
  const counter = useRef(0);
  const publish = () => {
    if (!mounted.current) return;
    setCart(operations.current.reduce((view, op) => op.apply(view), confirmed.current));
    setPending(new Set(operations.current.map((op) => op.productId)));
  };

  useLayoutEffect(() => { qtyStore.update(cart); }, [cart, qtyStore]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setCart(EMPTY);
      return;
    }
    const session = epoch.current;
    const revision = counter.current;
    if (!opts?.silent) setLoading(true);
    try {
      const next = await cartApi.fetchCart();
      if (mounted.current && session === epoch.current && revision === counter.current && !operations.current.length) {
        // Unchanged cart: keep the same object so nothing re-renders.
        const same = JSON.stringify(next) === JSON.stringify(confirmed.current);
        confirmed.current = next;
        if (!same) setCart(next);
      }
    } catch {
      // A failed refresh should not wipe a cart the user can still see
    } finally {
      if (mounted.current && !opts?.silent) setLoading(false);
    }
  }, [user?._id]);

  // Load on sign-in, drop on sign-out
  useEffect(() => {
    epoch.current++;
    operations.current = [];
    confirmed.current = EMPTY;
    setPending(new Set());
    setCart(EMPTY);
    if (user) void refresh();
  }, [user?._id, refresh]);

  const run = useCallback(
    (productId: string, fn: () => Promise<CartView>, apply: (view: CartView) => CartView) => {
      const op = { id: ++counter.current, productId, apply, request: fn };
      const session = epoch.current;
      operations.current.push(op);
      publish();
      const task = serial.current.then(async () => {
        if (session !== epoch.current) return;
        try {
          const next = await fn();
          if (session !== epoch.current) return;
          confirmed.current = next;
          if (next.notice) toast.show(next.notice);
        } catch (err) {
          if (session === epoch.current) toast.error(getErrorMessage(err));
        } finally {
          if (session === epoch.current) {
            operations.current = operations.current.filter((item) => item.id !== op.id);
            publish();
          }
        }
      });
      serial.current = task.catch(() => undefined);
      return task;
    }, [toast],
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
    (productId: string, quantity = 1, _productName?: string, product?: ProductSummary) =>
      run(productId, () => cartApi.addCartItem(productId, quantity), (view) => {
        const current = view.groups.flatMap((g) => g.items).find((i) => i.productId === productId)?.quantity ?? 0;
        return optimisticQuantity(view, productId, current + quantity, product);
      }), [run],
  );
  const setQuantity = useCallback(
    (productId: string, quantity: number) => run(productId,
      () => quantity <= 0 ? cartApi.removeCartItem(productId) : cartApi.setCartItemQuantity(productId, quantity),
      (view) => optimisticQuantity(view, productId, quantity)), [run],
  );
  const remove = useCallback((productId: string) => setQuantity(productId, 0), [setQuantity]);

  const clear = useCallback(() => run('__all', () => cartApi.clearCart(), () => EMPTY), [run]);

  const value = useMemo<CartApi>(
    () => ({ cart, loading, pending, refresh, settle: async () => { await serial.current; }, quantityOf, add, setQuantity, remove, clear, applyCart: (next: CartView) => { confirmed.current = next; publish(); } }),
    [cart, loading, pending, refresh, quantityOf, add, setQuantity, remove, clear],
  );

  const actions = useMemo<CartActions>(() => ({ add, setQuantity, remove, qtyStore }), [add, setQuantity, remove, qtyStore]);

  return (
    <CartActionsContext.Provider value={actions}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </CartActionsContext.Provider>
  );
}

/** For product cards: this product's quantity plus the actions, re-rendering only when THIS quantity changes. */
export function useCartItem(productId: string) {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error('useCartItem must be used inside <CartProvider>');
  const quantity = useSyncExternalStore(ctx.qtyStore.subscribe, () => ctx.qtyStore.get(productId), () => 0);
  return { quantity, add: ctx.add, setQuantity: ctx.setQuantity, remove: ctx.remove };
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

export function optimisticQuantity(view: CartView, id: string, requested: number, product?: ProductSummary): CartView {
  const existing = view.groups.flatMap((g) => g.items).find((i) => i.productId === id);
  const quantity = Math.max(0, Math.min(20, existing?.stock ?? product?.stock ?? 20, requested));
  let groups = view.groups.map((g) => ({ ...g, items: g.items.map((i) => i.productId === id
    ? { ...i, quantity, lineTotal: i.price * quantity } : i).filter((i) => i.quantity > 0) }));
  if (!existing && quantity > 0 && product) {
    const line = { productId: id, name: product.name, slug: product.slug, image: product.images[0] ?? null,
      icon: product.icon, unit: product.unit, price: product.price, mrp: product.mrp, quantity,
      lineTotal: product.price * quantity, stock: product.stock, issue: null,
      codAvailable: product.codAvailable, onlineAvailable: product.onlineAvailable, deliveryDays: product.deliveryDays };
    const group = groups.find((g) => g.shop.id === product.shop?._id);
    if (group) group.items.push(line);
    else groups.push({ shop: { id: product.shop?._id ?? id, name: product.shop?.name ?? 'Your warehouse',
      slug: product.shop?.slug ?? '', logo: null, isOpen: product.shop?.isOpen ?? true, minOrderAmount: 0 },
      items: [line], subtotal: 0, deliveryFee: 0, total: 0, meetsMinOrder: true });
  }
  groups = groups.filter((g) => g.items.length).map((g) => {
    const subtotal = g.items.reduce((sum, i) => sum + i.lineTotal, 0);
    return { ...g, subtotal, total: subtotal + g.deliveryFee, meetsMinOrder: subtotal >= g.shop.minOrderAmount };
  });
  const subtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  const deliveryFee = groups.reduce((sum, g) => sum + g.deliveryFee, 0);
  return { ...view, groups, subtotal, deliveryFee, total: subtotal + deliveryFee,
    itemCount: groups.reduce((sum, g) => sum + g.items.reduce((n, i) => n + i.quantity, 0), 0) };
}
