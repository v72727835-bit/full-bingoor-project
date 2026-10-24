import { api } from '../lib/client';
import * as n from '../lib/normalize';
import { CartView, Quote, SlotKey } from '../lib/types';

export const fetchCart = async (): Promise<CartView> => {
  const { data } = await api.get('/cart');
  return n.cart(data.data);
};

export const addCartItem = async (productId: string, quantity = 1): Promise<CartView> => {
  const { data } = await api.post('/cart/items', { productId, quantity });
  return n.cart(data.data);
};

export const updateCartItem = async (productId: string, quantity: number): Promise<CartView> => {
  const { data } = await api.patch(`/cart/items/${productId}`, { quantity });
  return n.cart(data.data);
};

export const removeCartItem = async (productId: string): Promise<CartView> => {
  const { data } = await api.delete(`/cart/items/${productId}`);
  return n.cart(data.data);
};

export const clearCart = async (): Promise<CartView> => {
  const { data } = await api.delete('/cart');
  return n.cart(data.data);
};

/** What this basket costs to deliver to an address - handling, delivery, 2 hour charge, COD rules. */
export const fetchQuote = async (params: { addressId?: string; slot: SlotKey; paymentMethod?: 'cod' | 'online' }): Promise<Quote> => {
  const { data } = await api.get('/cart/quote', { params });
  return data.data as Quote;
};
