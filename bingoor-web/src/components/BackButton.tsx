'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { Icon } from './Icon';
import s from './BackButton.module.css';

/**
 * Going back one step. A deep aisle is usually three taps from the home feed,
 * and on a phone the browser chrome is hidden, so the page carries its own
 * back control. Opened from a shared link there is no history to pop, so it
 * falls back to the fallback route rather than doing nothing.
 */
export function BackButton({ fallback = '/', label = 'Back' }: { fallback?: string; label?: string }) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button className={s.btn} onClick={goBack} aria-label={label}>
      <Icon name="chevron-left" size={18} />
      {label}
    </button>
  );
}
