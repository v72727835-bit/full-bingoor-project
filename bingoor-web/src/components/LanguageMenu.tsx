'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Icon } from './Icon';
import s from './LanguageMenu.module.css';

/** A small "EN ▾ / हिं ▾" menu - English or Hindi for the whole storefront. */
export function LanguageMenu({ upward }: { upward?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) return e.key === 'Escape' ? setOpen(false) : undefined;
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className={s.wrap} ref={ref}>
      <button type="button" className={s.btn} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label={t('language')}>
        <span>{lang === 'hi' ? 'हिं' : 'EN'}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <ul className={`${s.menu} ${upward ? s.up : ''}`} role="listbox" aria-label={t('language')}>
          {(
            [
              ['en', 'English'],
              ['hi', 'हिन्दी'],
            ] as const
          ).map(([code, label]) => (
            <li key={code} role="option" aria-selected={lang === code}>
              <button
                type="button"
                className={s.opt}
                data-on={lang === code}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                }}
              >
                {label}
                {lang === code ? <Icon name="check" size={14} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
