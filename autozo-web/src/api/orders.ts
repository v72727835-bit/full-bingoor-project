import { api } from '../lib/client';
import * as n from '../lib/normalize';
import { Order, SlotKey } from '../lib/types';
import { PageMeta } from './catalog';

/** What placing an order gives back: the order(s) made, or a payment that still has to be completed. */
export type PlaceResult =
  | { kind: 'placed'; order: Order; count: number }
  | { kind: 'pay'; razorpayOrderId: string; amount: number; keyId: string; payOption?: string };

/** One checkout can split into several orders (one per warehouse); the first one is shown. */
const placed = (data: { orders?: Record<string, unknown>[] } & Record<string, unknown>): PlaceResult => {
  const list = data.orders && data.orders.length ? data.orders : [data];
  return { kind: 'placed', order: n.order(list[0]), count: list.length };
};

export const placeOrder = async (
  addressId: string,
  paymentMethod: 'cod' | 'online' = 'cod',
  note?: string,
  slot: SlotKey = 'instant',
  payOption?: string,
  tip = 0,
): Promise<PlaceResult> => {
  const { data } = await api.post('/orders', { addressId, paymentMethod, note, slot, tip, ...(paymentMethod === 'online' && payOption ? { payOption } : {}) });
  const body = data.data as { requiresPayment?: boolean; razorpayOrderId?: string; amount?: number; keyId?: string; payOption?: string } & Record<string, unknown>;
  if (body.requiresPayment) {
    return { kind: 'pay', razorpayOrderId: body.razorpayOrderId as string, amount: body.amount as number, keyId: body.keyId as string, payOption: body.payOption };
  }
  return placed(body);
};

/** After the Razorpay window reports success: verify it on the server, which then places the orders. */
export const confirmOnlinePayment = async (p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Promise<PlaceResult> => {
  const { data } = await api.post('/orders/online/confirm', p);
  return placed(data.data);
};

export const fetchOrders = async (page = 1, limit = 20): Promise<{ items: Order[]; meta: PageMeta }> => {
  const { data } = await api.get('/orders', { params: { page, limit } });
  return { items: (data.data as Record<string, unknown>[]).map(n.order), meta: data.meta };
};

export const fetchOrder = async (id: string): Promise<Order> => {
  const { data } = await api.get(`/orders/${id}`);
  return n.order(data.data);
};

export const cancelOrder = async (id: string): Promise<Order> => {
  const { data } = await api.post(`/orders/${id}/cancel`);
  return n.order(data.data);
};

export const reorder = async (id: string): Promise<void> => {
  await api.post(`/orders/${id}/reorder`);
};

/** A short-lived link that opens the invoice (A4) or the thermal bill in a new tab. */
export const fetchInvoiceLinks = async (id: string): Promise<{ a4: string; pos: string }> => {
  const { data } = await api.post(`/orders/${id}/invoice-link`);
  return data.data;
};
