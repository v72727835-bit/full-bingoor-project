'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchPointsProducts } from '../api/catalog';
import { getErrorMessage } from '../lib/client';
import { Product } from '../lib/types';
import { Icon } from './Icon';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { Alert } from './ui';
import s from './TopUpSheet.module.css';

/**
 * #35 "See all products": a Blinkit-style half-page sheet that slides up over
 * the cart and lists every top-up (50-point) product in a scrollable grid, so
 * the customer can pick one without leaving the cart.
 */
export function TopUpSheet({ open, onClose, onlyIds }: { open: boolean; onClose: () => void; /** The cart's own suggestions (same warehouse, not in the basket yet). */ onlyIds?: Set<string> }) {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setError('');
    fetchPointsProducts()
      .then(setItems)
      .catch((e) => {
        setError(getErrorMessage(e));
        setItems([]);
      });
  }, [open]);

  // Lock the page behind the sheet so only the sheet scrolls.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // On <body>, so no animated parent can trap the sheet inside the page.
  return createPortal(
    <div className={s.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={s.grip} />
        <div className={s.head}>
          <h3 className={s.title}>Add more to your order</h3>
          <button type="button" className={s.x} onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className={s.body}>
          {error ? <Alert tone="bad">{error}</Alert> : null}
          {!items ? (
            <div className="grid-products">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="body-sm" style={{ textAlign: 'center', padding: '28px 0' }}>
              Nothing here right now.
            </p>
          ) : (
            <div className="grid-products">
              {(onlyIds && onlyIds.size ? items.filter((p) => onlyIds.has(p.id)) : items).map((p) => (
                <ProductCard key={p.id} product={p} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
