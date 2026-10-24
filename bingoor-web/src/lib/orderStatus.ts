import { OrderStatus } from './types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order received',
  accepted: 'Confirmed by the shop',
  preparing: 'Being packed',
  ready_for_pickup: 'Packed, waiting for a rider',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected by the shop',
};

/** Shown under whichever step the order is sitting on right now. */
export const STATUS_BLURB: Record<OrderStatus, string> = {
  placed: 'The shop has been notified and will confirm shortly.',
  accepted: 'The shop has accepted your order.',
  preparing: 'Your items are being packed right now.',
  ready_for_pickup: 'Your order is packed and a rider is being assigned.',
  out_for_delivery: 'Your rider is on the way — keep your OTP handy.',
  delivered: 'Thank you for shopping with us. Reorder any time in one tap.',
  cancelled: 'This order was cancelled.',
  rejected: 'The shop was unable to fulfil this order.',
};

export const STATUS_TONE: Record<OrderStatus, 'brand' | 'ok' | 'warn' | 'bad' | 'muted'> = {
  placed: 'brand',
  accepted: 'brand',
  preparing: 'warn',
  ready_for_pickup: 'warn',
  out_for_delivery: 'warn',
  delivered: 'ok',
  cancelled: 'bad',
  rejected: 'bad',
};

export const FLOW: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];

export const isFinal = (s: OrderStatus) => s === 'delivered' || s === 'cancelled' || s === 'rejected';
