'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { suggestProducts } from '../api/catalog';
import { fitClass } from '../lib/art';
import { Product } from '../lib/types';
import { Icon } from './Icon';
import { Spinner } from './ui';
import s from './SearchBar.module.css';

const PLACEHOLDERS = ['milk', 'bread', 'rice', 'snacks', 'soap', 'tea'];

export function SearchBar({
  autoFocus,
  onNavigate,
  variant = 'light',
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
  /** 'light' sits on the yellow header bar, 'plain' on a page background. */
  variant?: 'light' | 'plain';
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(0);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Rotating placeholder — a cheap hint at the catalogue's breadth.
  useEffect(() => {
    const t = setInterval(() => setHint((h) => (h + 1) % PLACEHOLDERS.length), 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term) {
      setItems([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        setItems(await suggestProducts(term));
        setOpen(true);
      } catch {
        /* a dropped suggestion shouldn't interrupt typing */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const go = () => {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
    onNavigate?.();
  };

  return (
    <div className={s.wrap} ref={box}>
      <form
        role="search"
        className={s.bar}
        data-variant={variant}
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <span className={s.lead}>
          <Icon name="search" size={17} />
        </span>
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={`Search "${PLACEHOLDERS[hint]}"`}
          aria-label="Search products"
          enterKeyHint="search"
        />
        {loading ? (
          <span className={s.trail}>
            <Spinner size={15} />
          </span>
        ) : q ? (
          <button type="button" className={s.trail} onClick={() => setQ('')} aria-label="Clear search">
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </form>

      {open && items.length > 0 ? (
        <div className={`${s.drop} rise`} role="listbox">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className={s.row}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              <span className={s.thumb}>
                <Image src={p.photo} alt="" width={68} height={68} className={fitClass(p.photo, s.thumbArt)} unoptimized />
              </span>
              <span className={s.text}>
                <span className={`${s.rowName} clamp-1`}>{p.name}</span>
                <span className={s.rowSub}>
                  {p.brand ? `${p.brand} · ` : ''}
                  {p.unit}
                </span>
              </span>
              <span className={`num ${s.rowPrice}`}>₹{p.price}</span>
            </Link>
          ))}
          <button type="button" className={s.all} onClick={go}>
            All results for “{q.trim()}”
            <Icon name="arrow-right" size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
