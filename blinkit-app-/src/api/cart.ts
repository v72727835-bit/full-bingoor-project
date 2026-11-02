import { ApiEnvelope, CartView } from '../types';
import { api } from './client';

export async function fetchCart(): Promise<CartView> {
  const { data } = await api.get<ApiEnvelope<CartView>>('/cart');
  return data.data;
}

export async function addCartItem(productId: string, quantity = 1): Promise<CartView> {
  const { data } = await api.post<ApiEnvelope<CartView>>('/cart/items', { productId, quantity });
  return data.data;
}

/** quantity 0 removes the line. */
export async function setCartItemQuantity(productId: string, quantity: number): Promise<CartView> {
  const { data } = await api.patch<ApiEnvelope<CartView>>(`/cart/items/${productId}`, { quantity });
  return data.data;
}

export async function removeCartItem(productId: string): Promise<CartView> {
  const { data } = await api.delete<ApiEnvelope<CartView>>(`/cart/items/${productId}`);
  return data.data;
}

export async function clearCart(): Promise<CartView> {
  const { data } = await api.delete<ApiEnvelope<CartView>>('/cart');
  return data.data;
}
