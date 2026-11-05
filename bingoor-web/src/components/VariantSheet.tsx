'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../lib/client';
import { Product } from '../lib/types';
import { Icon } from './Icon';
import { QuantityStepper } from './QuantityStepper';
import s from './VariantSheet.module.css';

/**
 * Point 22: every size of one item (500 g / 1 kg / 2 kg…), opened from a
 * card's "ADD - 3 options". A sheet from the bottom on phones and a panel on
 * the right on desktop, like Blinkit; each size has its own ADD.
 */
export function VariantSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { name } = useLanguage();
  const { quantityOf, addItem, updateItem } = useCart();
  const { show } = useToast();
  const [busy, setBusy] = useState('');

  // Only the sheet scrolls while it is open; Escape closes it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      show(getErrorMessage(e), 'error');
    } finally {
      setBusy('');
    }
  };

  const sizes = product.variants ?? [];
  // On <body>: a card lifts (transform) on hover, which would trap a fixed overlay inside it.
  return createPortal(
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={`${product.name} - choose a size`} onClick={onClose}>
      <div className={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={s.grip} />
        <div className={s.head}>
          <h3 className={`${s.title} clamp-2`}>{name(product)}</h3>
          <button type="button" className={s.x} onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className={s.body}>
          {sizes.map((v) => {
            const qty = quantityOf(v.id);
            const off = v.mrp && v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
            return (
              <div key={v.id} className={s.row}>
                <Link href={`/products/${v.slug}`} className={s.art} onClick={onClose}>
                  {off > 0 ? <span className={`num ${s.off}`}>{off}% OFF</span> : null}
                  <Image src={v.image || product.photo} alt="" width={72} height={72} className={s.img} unoptimized />
                </Link>
                <div className={s.info}>
                  <span className={s.label}>{v.label}</span>
                  <span className={s.prices}>
                    <span className={`num ${s.price}`}>₹{v.price}</span>
                    {v.mrp ? <s className={`num ${s.mrp}`}>₹{v.mrp}</s> : null}
                  </span>
                </div>
                {v.inStock ? (
                  <QuantityStepper
                    size="sm"
                    quantity={qty}
                    busy={false}
                    onAdd={() => act(v.id, () => addItem(v.id, 1, { ...product, id: v.id, slug: v.slug, unit: v.label, price: v.price, mrp: v.mrp, inStock: v.inStock }))}
                    onIncrement={() => act(v.id, () => updateItem(v.id, qty + 1))}
                    onDecrement={() => act(v.id, () => updateItem(v.id, qty - 1))}
                  />
                ) : (
                  <span className={s.out}>Out of stock</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
