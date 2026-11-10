import { ApiEnvelope, CartView, Order, OrderStatus, Paged, PaymentMethod, PaymentRequired, PlaceOrderResult } from '../types';
import { api } from './client';

export async function placeOrder(input: {
  addressId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  /** Which online way to pay (UPI, card, net banking...): its charge is added to the bill. */
  payOption?: string;
}): Promise<PlaceOrderResult | PaymentRequired> {
  const { data } = await api.post<ApiEnvelope<PlaceOrderResult | PaymentRequired>>('/orders', input);
  return data.data;
}

/** The server's price for this basket to an address: the charge of each way to pay. */
export async function fetchQuote(addressId: string): Promise<{ paymentFees?: Record<string, number>; days?: number }> {
  const { data } = await api.get<ApiEnvelope<{ paymentFees?: Record<string, number>; days?: number }>>('/cart/quote', { params: { addressId, slot: 'instant' } });
  return data.data;
}

export async function fetchOrders(params: { active?: boolean; status?: OrderStatus; page?: number } = {}): Promise<
  Paged<Order>
> {
  const query: Record<string, string | number> = { page: params.page ?? 1, limit: 20 };
  if (params.status) query.status = params.status;
  else if (params.active !== undefined) query.active = String(params.active);

  const { data } = await api.get<ApiEnvelope<Order[]>>('/orders', { params: query });
  return { items: data.data, meta: data.meta };
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data } = await api.get<ApiEnvelope<Order>>(`/orders/${id}`);
  return data.data;
}

export async function cancelOrder(id: string, reason?: string): Promise<Order> {
  const { data } = await api.post<ApiEnvelope<Order>>(`/orders/${id}/cancel`, reason ? { reason } : {});
  return data.data;
}

export async function reorder(id: string): Promise<{ cart: CartView; skipped: { name: string; reason: string }[] }> {
  const { data } = await api.post<ApiEnvelope<{ cart: CartView; skipped: { name: string; reason: string }[] }>>(
    `/orders/${id}/reorder`,
    {},
  );
  return data.data;
}
