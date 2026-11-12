'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Icon } from './Icon';
import s from './PopupPages.module.css';

/**
 * Point 30: full-screen promo pages the admin uploads. One appears on a timer
 * (every intervalSeconds, default 3.5 min), a different page each time, closed
 * with the cross. Turned on/off from the admin panel.
 */
export function PopupPages() {
  const settings = useSettings();
  const popup = settings?.popup;
  const pages = (popup?.enabled ? popup.pages : [])?.filter((p) => p.image) ?? [];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The next show time is kept in localStorage, so the timer keeps running across page
  // reloads and new tabs instead of starting again from zero on every page.
  const every = Math.max(15, popup?.intervalSeconds ?? 210) * 1000;
  const KEY = 'bingoor.popup.nextAt';
  const arm = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    try {
      localStorage.setItem(KEY, String(Date.now() + delay));
    } catch {
      /* private mode: timer still works for this page */
    }
    timer.current = setTimeout(() => setOpen(true), delay);
  };

  useEffect(() => {
    if (!pages.length) {
      setOpen(false);
      return;
    }
    let delay = every;
    try {
      const saved = Number(localStorage.getItem('bingoor.popup.index'));
      if (saved > 0) setIndex(saved % pages.length);
      const at = Number(localStorage.getItem(KEY));
      if (at > 0) delay = Math.max(1500, Math.min(every, at - Date.now()));
    } catch {
      /* ignore */
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length, every]);

  const close = () => {
    setOpen(false);
    setIndex((i) => {
      const next = pages.length ? (i + 1) % pages.length : 0;
      try {
        localStorage.setItem('bingoor.popup.index', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    arm(every);
  };

  if (!open || !pages.length) return null;
  const page = pages[Math.min(index, pages.length - 1)];
  const link = page.link || undefined;

  const body = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={page.image} alt="Promotion" className={s.img} />
  );

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" onClick={close}>
      <div className={s.inner} onClick={(e) => e.stopPropagation()}>
        {link ? (
          <a href={link} onClick={close} className={s.link}>
            {body}
          </a>
        ) : (
          body
        )}
        <button type="button" className={s.close} onClick={close} aria-label="Close">
          <Icon name="x" size={20} />
        </button>
      </div>
    </div>
  );
}
