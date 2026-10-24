'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as cartApi from '../api/cart';
import { CartView } from '../lib/types';
import { useAuth } from './AuthContext';

interface CartApi {
  cart: CartView | null;
  loading: boolean;
  /** Quantity of one product across every shop group, for card steppers. */
  quantityOf: (productId: string) => number;
  refresh: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartApi | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      setCart(await cartApi.fetchCart());
    } catch {
      /* a failed read shouldn't blank a cart the user can still see */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Flat productId -> quantity map; rails render dozens of cards at once. */
  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    cart?.groups.forEach((g) =>
      g.items.forEach((i) => map.set(i.productId, (map.get(i.productId) ?? 0) + i.quantity)),
    );
    return map;
  }, [cart]);

  const quantityOf = useCallback((productId: string) => quantities.get(productId) ?? 0, [quantities]);

  const addItem = async (productId: string, quantity = 1) => setCart(await cartApi.addCartItem(productId, quantity));

  const updateItem = async (productId: string, quantity: number) => {
    if (quantity <= 0) setCart(await cartApi.removeCartItem(productId));
    else setCart(await cartApi.updateCartItem(productId, quantity));
  };

  const removeItem = async (productId: string) => setCart(await cartApi.removeCartItem(productId));

  const clear = async () => setCart(await cartApi.clearCart());

  return (
    <CartContext.Provider value={{ cart, loading, quantityOf, refresh, addItem, updateItem, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
