import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { CartProvider, useCart } from '../src/context/CartContext';
import * as api from '../src/api/cart';
import type { CartView, ProductSummary } from '../src/types';

jest.mock('../src/api/cart', () => ({ fetchCart: jest.fn(), addCartItem: jest.fn(), setCartItemQuantity: jest.fn(), removeCartItem: jest.fn(), clearCart: jest.fn() }));
jest.mock('../src/api/client', () => ({ getErrorMessage: (err: Error) => err.message }));
const mockToast = { show: jest.fn(), success: jest.fn(), error: jest.fn() };
jest.mock('../src/ui/Toast', () => ({ useToast: () => mockToast }));
const mockUser = { _id: 'customer' };
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

const product: ProductSummary = { _id: 'milk', name: 'Milk', slug: 'milk', images: [], price: 50, mrp: 60,
  unit: '1 L', stock: 20, inStock: true, discountPercent: 17, rating: 0, ratingCount: 0,
  shop: { _id: 'warehouse', name: 'Warehouse', slug: 'warehouse', isOpen: true } };
const empty: CartView = { groups: [], itemCount: 0, subtotal: 0, total: 0, deliveryFee: 0, hasIssues: false, freeDeliveryAbove: 499 };
let cart: ReturnType<typeof useCart>;
function Probe() { cart = useCart(); return null; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('slow writes keep rapid taps visible, reconcile stock and roll back a failed request', async () => {
  (api.fetchCart as jest.Mock).mockResolvedValue(empty);
  const add = deferred<CartView>();
  const update = deferred<CartView>();
  (api.addCartItem as jest.Mock).mockReturnValue(add.promise);
  (api.setCartItemQuantity as jest.Mock).mockReturnValue(update.promise);
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<CartProvider><Probe /></CartProvider>); });
  act(() => { void cart.add('milk', 1, 'Milk', product); });
  expect(cart.quantityOf('milk')).toBe(1);
  expect(cart.cart.total).toBe(50);
  act(() => { void cart.setQuantity('milk', 3); });
  expect(cart.quantityOf('milk')).toBe(3);
  expect(api.setCartItemQuantity).not.toHaveBeenCalled();
  // The first server response must not erase a later tap still in the queue.
  const confirmed = { ...cart.cart, itemCount: 1, subtotal: 50, total: 50,
    groups: cart.cart.groups.map((g) => ({ ...g, subtotal: 50, total: 50,
      items: g.items.map((i) => ({ ...i, quantity: 1, lineTotal: 50 })) })) };
  await act(async () => { add.resolve(confirmed); await Promise.resolve(); });
  expect(cart.quantityOf('milk')).toBe(3);
  expect(api.setCartItemQuantity).toHaveBeenCalledWith('milk', 3);
  await act(async () => { update.reject(new Error('Out of stock')); await cart.settle(); });
  expect(cart.quantityOf('milk')).toBe(1);
  expect(cart.cart.total).toBe(50);
  expect(cart.pending.size).toBe(0);
  expect(mockToast.error).toHaveBeenCalledWith('Out of stock');
  await act(async () => { renderer.unmount(); });
});
