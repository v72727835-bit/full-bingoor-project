import { ApiEnvelope, CartQuote, CartView } from '../types';
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

/** A visitor's basket (kept on the phone) priced by the server; nothing is stored there. */
export async function fetchGuestCart(items: { productId: string; quantity: number }[], point?: { lat: number; lng: number } | null): Promise<CartView> {
  const { data } = await api.post<ApiEnvelope<CartView>>('/cart/guest', { items, ...(point ?? {}) });
  return data.data;
}

/** Handling fee, delivery fee and what each way to pay adds, for the cart going to this address. */
export async function fetchQuote(addressId: string): Promise<CartQuote> {
  const { data } = await api.get<ApiEnvelope<CartQuote>>('/cart/quote', { params: { addressId, slot: 'instant' } });
  return data.data;
}

/** The quote for the customer's current delivery point, so the cart can show the distance-based delivery time. */
export async function fetchPointQuote(point: { lat: number; lng: number }): Promise<CartQuote> {
  const { data } = await api.get<ApiEnvelope<CartQuote>>('/cart/quote', { params: { ...point, slot: 'instant' } });
  return data.data;
}
