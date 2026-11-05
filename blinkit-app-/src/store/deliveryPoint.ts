import { useSyncExternalStore } from 'react';
import type { Address } from '../types';

/**
 * Where the customer wants things delivered: the pin on their default address.
 *
 * The catalogue only shows products from shops that deliver to this point, so
 * the API client adds it to every home / product-list / search request. The
 * rounded "lat,lng" key is also part of each cached query's arguments, so
 * moving the pin refetches instead of showing another area's products.
 */
type Point = { lat: number; lng: number };

let point: Point | null = null;
let key = '';
const listeners = new Set<() => void>();

/** Rounded to ~100 m so nearby customers share cached server responses. */
const round = (n: number) => Math.round(n * 1000) / 1000;

export function setDeliveryPoint(next: Point | null) {
  const nextKey = next ? `${round(next.lat)},${round(next.lng)}` : '';
  if (point?.lat === next?.lat && point?.lng === next?.lng) return;
  point = next ? { ...next } : null;
  key = nextKey;
  listeners.forEach((l) => l());
}

/** Picks the default address's pin (or any pinned address) from a list. */
export function syncPointFromAddresses(addresses: Address[] | undefined) {
  const pinned = addresses?.find((a) => a.isDefault && a.location) ?? addresses?.find((a) => a.location);
  if (pinned?.location) setDeliveryPoint(pinned.location);
}

export function deliveryPointParams(): Point | null {
  return point;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The current point as a cache key ('' when unknown). */
export function useDeliveryPointKey(): string {
  return useSyncExternalStore(subscribe, () => key);
}
