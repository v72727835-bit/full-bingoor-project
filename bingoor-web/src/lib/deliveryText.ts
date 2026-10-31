import { Home } from './types';

/** The delivery promise to show next to products and in the header: "19 min", "2 hours", "Next day delivery". */
export function shortDelivery(home: Pick<Home, 'deliveryMins' | 'deliveryText'> | null | undefined): string {
  if (!home) return '';
  const text = home.deliveryText || `${home.deliveryMins} minutes`;
  return text.replace(/\bminutes?\b/i, 'min');
}
