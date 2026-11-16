import React from 'react';
import { OrderStatus } from '../types';
import { Pill } from '../ui/Surface';
import type { IconName } from '../ui/Button';

interface Meta {
  label: string;
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon: IconName;
  /** Copy shown under the tracker on the order page. */
  blurb: string;
}

export const ORDER_META: Record<OrderStatus, Meta> = {
  placed: {
    label: 'Order placed',
    tone: 'info',
    icon: 'receipt-outline',
    blurb: 'We have sent your order to the shop. Waiting for them to accept it.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'info',
    icon: 'checkmark-circle-outline',
    blurb: 'The shop has accepted your order and will start packing shortly.',
  },
  preparing: {
    label: 'Being packed',
    tone: 'warning',
    icon: 'cube-outline',
    blurb: 'Your items are being packed right now.',
  },
  ready_for_pickup: {
    label: 'Ready for pickup',
    tone: 'warning',
    icon: 'bag-check-outline',
    blurb: 'Your order is packed and waiting for a delivery partner.',
  },
  out_for_delivery: {
    label: 'On the way',
    tone: 'brand',
    icon: 'bicycle-outline',
    blurb: 'Your delivery partner is on the way. Keep your OTP handy.',
  },
  delivered: {
    label: 'Delivered',
    tone: 'success',
    icon: 'checkmark-circle-outline',
    blurb: 'Delivered. We hope everything arrived in good shape.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'danger',
    icon: 'close-circle',
    blurb: 'This order was cancelled.',
  },
  rejected: {
    label: 'Rejected by shop',
    tone: 'danger',
    icon: 'close-circle',
    blurb: 'The shop could not take this order. Any payment will be refunded.',
  },
};

/** Live steps shown in the tracker, in order. */
export const TRACK_STEPS: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
];

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const meta = ORDER_META[status];
  return <Pill label={meta.label} tone={meta.tone} />;
}
