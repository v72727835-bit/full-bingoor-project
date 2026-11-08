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

  useEffect(() => {
    if (!pages.length) {
      setOpen(false);
      return;
    }
    const every = Math.max(15, popup?.intervalSeconds ?? 210) * 1000;
    timer.current = setTimeout(() => setOpen(true), every);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pages.length, popup?.intervalSeconds]);

  const close = () => {
    setOpen(false);
    setIndex((i) => (pages.length ? (i + 1) % pages.length : 0));
    if (timer.current) clearTimeout(timer.current);
    const every = Math.max(15, popup?.intervalSeconds ?? 210) * 1000;
    timer.current = setTimeout(() => setOpen(true), every);
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
