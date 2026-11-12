import { useSyncExternalStore } from 'react';

/** The delivery-partner tip picked in the cart, carried over to checkout (rupees, 0 = none). */
let tip = 0;
const listeners = new Set<() => void>();

export function setTip(next: number) {
  tip = Math.max(0, Math.min(500, Math.round(next) || 0));
  listeners.forEach((l) => l());
}

export function getTip() {
  return tip;
}

export function useTip(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => tip,
  );
}
