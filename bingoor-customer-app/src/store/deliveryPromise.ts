import { useSyncExternalStore } from 'react';

/**
 * The delivery promise for the customer's location: "19 min" within 15 km,
 * "Next day delivery" from 15 to 30 km, "3 days delivery" beyond. Home reads it
 * from the server (which knows the distance to the nearest warehouse) and shares
 * it here, so every product card in every list (search, categories, shop,
 * wishlist...) shows the same promise as the header instead of a fixed "19 min".
 */
let promise = '19 min';
const listeners = new Set<() => void>();

export function setDeliveryPromise(next: string) {
  const text = next.trim();
  if (!text || text === promise) return;
  promise = text;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDeliveryPromise(): string {
  return useSyncExternalStore(subscribe, () => promise, () => promise);
}
