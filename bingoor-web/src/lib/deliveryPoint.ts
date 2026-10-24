'use client';

/**
 * Where the customer wants things delivered: the pin on their default address.
 *
 * The catalogue only shows products from shops that deliver to this point, so
 * it is sent with every home/product request. Kept in localStorage so a
 * returning visitor sees their own area straight away, and broadcast as a
 * window event so the home feed reloads when it changes.
 */
export interface DeliveryPoint {
  lat: number;
  lng: number;
  label?: string;
}

const KEY = 'autozo_point';
export const POINT_EVENT = 'bingoor:point';

export function getDeliveryPoint(): DeliveryPoint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeliveryPoint) : null;
  } catch {
    return null;
  }
}

export function setDeliveryPoint(point: DeliveryPoint | null) {
  if (typeof window === 'undefined') return;
  const before = JSON.stringify(getDeliveryPoint());
  try {
    if (point) localStorage.setItem(KEY, JSON.stringify(point));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked - the point simply is not remembered */
  }
  if (JSON.stringify(point) !== before) window.dispatchEvent(new Event(POINT_EVENT));
}

/** Rounded to ~100 m so nearby customers share cached catalogue responses. */
export function pointParams(): { lat: number; lng: number } | null {
  const p = getDeliveryPoint();
  return p ? { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 } : null;
}
