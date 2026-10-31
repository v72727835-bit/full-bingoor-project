'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import s from './Rail.module.css';

/**
 * A horizontal row with arrows to slide it. The row itself still scrolls by
 * touch and trackpad as before; the arrows are for everyone else, and they
 * hide themselves at each end so they never point nowhere.
 */
export function Rail({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // 1px of slack: sub-pixel widths otherwise leave the arrow on forever.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  const slide = (dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    // A little less than a full screen, so the card at the edge stays in view.
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <div className={s.wrap}>
      <div className={`rail ${className}`} ref={track} onScroll={measure}>
        {children}
      </div>

      <button
        type="button"
        className={`${s.arrow} ${s.left}`}
        data-hidden={atStart}
        onClick={() => slide(-1)}
        aria-label="Slide left"
        tabIndex={atStart ? -1 : 0}
      >
        <Icon name="chevron-left" size={18} />
      </button>
      <button
        type="button"
        className={`${s.arrow} ${s.right}`}
        data-hidden={atEnd}
        onClick={() => slide(1)}
        aria-label="Slide right"
        tabIndex={atEnd ? -1 : 0}
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
  );
}
