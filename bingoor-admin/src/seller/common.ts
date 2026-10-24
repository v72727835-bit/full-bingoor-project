import type { Tone } from '../components/ui';

export const STATUS_LABEL: Record<string, string> = {
  placed: 'New', accepted: 'Accepted', preparing: 'Preparing', ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', rejected: 'Rejected',
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
export const statusTone = (s: string): Tone =>
  s === 'delivered' ? 'success' : s === 'cancelled' || s === 'rejected' ? 'danger' : s === 'placed' ? 'warn' : 'brand';
