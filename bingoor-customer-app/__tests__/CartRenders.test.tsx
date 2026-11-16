import React from 'react';
import { act, create } from 'react-test-renderer';
import { CartProvider, useCartItem } from '../src/context/CartContext';
import * as api from '../src/api/cart';
import type { CartView, ProductSummary } from '../src/types';

jest.mock('../src/api/cart', () => ({ fetchCart: jest.fn(), addCartItem: jest.fn(), setCartItemQuantity: jest.fn(), removeCartItem: jest.fn(), clearCart: jest.fn() }));
jest.mock('../src/api/client', () => ({ getErrorMessage: (err: Error) => err.message }));
jest.mock('../src/ui/Toast', () => { const t = { show: jest.fn(), success: jest.fn(), error: jest.fn() }; return { useToast: () => t }; });
const mockUser = { _id: 'customer' };
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

const prod = (id: string): ProductSummary => ({ _id: id, name: id, slug: id, images: [], price: 10, mrp: 12, unit: '1', stock: 20, inStock: true, discountPercent: 0, rating: 0, ratingCount: 0, shop: { _id: 'w', name: 'W', slug: 'w', isOpen: true } });
const empty: CartView = { groups: [], itemCount: 0, subtotal: 0, total: 0, deliveryFee: 0, hasIssues: false, freeDeliveryAbove: 499 };

const renders: Record<string, number> = { a: 0, b: 0 };
let acts: ReturnType<typeof useCartItem>;
const quantities: Record<string, number> = {};
function Card({ id }: { id: string }) {
  const item = useCartItem(id);
  renders[id]++;
  quantities[id] = item.quantity;
  if (id === 'a') acts = item;
  return null;
}

test('adding one product re-renders only that product card', async () => {
  (api.fetchCart as jest.Mock).mockResolvedValue(empty);
  (api.addCartItem as jest.Mock).mockImplementation(() => new Promise(() => undefined)); // stays optimistic
  await act(async () => { create(<CartProvider><Card id="a" /><Card id="b" /></CartProvider>); });
  const before = { ...renders };
  act(() => { void acts.add('a', 1, 'a', prod('a')); });
  expect(quantities.a).toBe(1);
  expect(quantities.b).toBe(0);
  expect(renders.a).toBeGreaterThan(before.a);
  expect(renders.b).toBe(before.b); // the untouched card did not re-render
});
