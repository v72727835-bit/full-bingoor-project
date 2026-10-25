'use client';

/** #35: the tip for the delivery partner, picked on the cart page and paid at checkout. Kept for this browser only. */
const KEY = 'bingoor_tip';

export function getTip(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const n = Number(localStorage.getItem(KEY) || 0);
    return Number.isFinite(n) && n > 0 ? Math.min(500, Math.round(n)) : 0;
  } catch {
    return 0;
  }
}

export function setTip(amount: number) {
  try {
    if (amount > 0) localStorage.setItem(KEY, String(Math.min(500, Math.round(amount))));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked - the tip lasts for this page only */
  }
}
