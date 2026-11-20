'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Product } from '../lib/types';
import { getErrorMessage } from '../lib/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { useWishlist } from '../context/WishlistContext';
import { Icon } from './Icon';
import { useLanguage } from '../context/LanguageContext';
import { fitClass } from '../lib/art';
import { useToast } from '../context/ToastContext';
import { NotifyMeButton } from './NotifyMe';
import { QuantityStepper } from './QuantityStepper';
import { VariantSheet } from './VariantSheet';
import { askForAccount } from './AccountPrompt';
import { FoodMark, Price, Rating } from './ui';
import s from './ProductCard.module.css';

/** Blend the section's pastel into the surface so dark mode stays dark. */
const tile = (tint?: string) =>
  tint ? `color-mix(in srgb, ${tint} var(--tint-mix), var(--surface))` : 'var(--surface-3)';

export function ProductCard({
  product,
  width,
  tint,
  compact,
}: {
  product: Product;
  /** Fixed width inside a rail; omit to fill a grid cell. */
  width?: number;
  tint?: string;
  /** The phone category layout: big photo, size chip and ADD on it, price and name below. */
  compact?: boolean;
}) {
  const { name } = useLanguage();
  const { user } = useAuth();
  const { quantityOf, addItem, updateItem } = useCart();
  const { home } = useCatalog();
  // The longer of the aisle's own days and the customer's distance (15-30 km next day, 30+ km 3 days).
  const days = Math.max(product.deliveryDays ?? 0, home?.deliveryDays ?? 0);
  const { show } = useToast();
  const router = useRouter();
  const wishlist = useWishlist();
  const wished = wishlist.has(product.id);
  const toggleWish = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // A visitor gets "Create account" instead of an error (the wishlist needs an account).
    if (!user) {
      askForAccount();
      return;
    }
    // Tell the customer what happened — the heart alone is easy to miss.
    const wasWished = wished;
    act(async () => {
      await wishlist.toggle(product.id);
      if (typeof navigator !== 'undefined') navigator.vibrate?.(14);
      show(wasWished ? 'Product is removed from wish list' : 'Product is added to wish list', 'success');
    });
  };
  const save = Math.max(0, Math.round((product.mrp ?? 0) - product.price));
  const [busy, setBusy] = useState(false);

  const qty = quantityOf(product.id);
  // Point 22: other sizes of this item. With more than one, ADD opens them all.
  const options = product.variants && product.variants.length > 1 ? product.variants.length : 0;
  const [sheet, setSheet] = useState(false);
  const optionsAdd = (
    <button type="button" className={s.optAdd} onClick={() => setSheet(true)} aria-label={`Add - choose from ${options} sizes`}>
      <span>ADD</span>
      <small>{options} options</small>
    </button>
  );
  const sizesSheet = sheet ? <VariantSheet product={product} onClose={() => setSheet(false)} /> : null;

  // Visitors can fill a cart too (#23); they sign in only at payment.
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      show(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <article className={s.cCard} style={width ? { width } : undefined}>
        <Link href={`/products/${product.slug}`} className={s.cArt} aria-label={product.name} style={{ ['--tile' as string]: tile(tint) }}>
          <Image src={product.photo} alt="" width={240} height={240} className={fitClass(product.photo, s.cImg)} unoptimized />
        </Link>
        <button type="button" className={s.heart} data-on={wished} onClick={toggleWish} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}>
          <Icon name={wished ? 'heart-fill' : 'heart'} size={16} />
        </button>
        <div className={s.cRow}>
          {/* The size sits in the text below, where it has room to show in full. */}
          <span />
          {product.inStock && options && qty === 0 ? (
            optionsAdd
          ) : product.inStock ? (
            <QuantityStepper
              size="sm"
              quantity={qty}
              busy={false}
              onAdd={() => act(() => addItem(product.id, 1, product))}
              onIncrement={() => act(() => updateItem(product.id, qty + 1))}
              onDecrement={() => act(() => updateItem(product.id, qty - 1))}
            />
          ) : (
            <NotifyMeButton productId={product.id} />
          )}
        </div>
        <div className={s.cBody}>
          <Price price={product.price} mrp={product.mrp} size={16} />
          {save > 0 ? <span className={s.save}>Save ₹{save}</span> : null}
          <Link href={`/products/${product.slug}`} className={`${s.cName} clamp-2`}>
            {name(product)}
          </Link>
          {product.unit ? <span className={s.cUnit}>{product.unit}</span> : null}
          {product.rating || product.ratingLabel ? (
            <div className={s.cRate}>
              {product.rating ? <Rating value={product.rating} count={product.ratingCount} size={11} /> : null}
              {product.ratingLabel ? <span className={s.rateLabel}>{product.ratingLabel}</span> : null}
            </div>
          ) : null}
          {options && qty > 0 ? (
            <button type="button" className={s.cOptions} onClick={() => setSheet(true)}>
              {options} options ›
            </button>
          ) : null}
        </div>
        {sizesSheet}
      </article>
    );
  }

  return (
    <article
      className={s.card}
      style={{ width: width ?? '100%', ['--tile' as string]: tile(tint) }}
    >
      <Link href={`/products/${product.slug}`} className={s.art} aria-label={product.name}>
        <span className={s.artBg} />
        <Image src={product.photo} alt="" width={240} height={240} className={fitClass(product.photo, s.artImg)} unoptimized />
        {product.discountPercent > 0 ? (
          <span className={`num ${s.off}`}>{product.discountPercent}% OFF</span>
        ) : null}
      </Link>
      <button type="button" className={s.heart} data-on={wished} onClick={toggleWish} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}>
            <Icon name={wished ? 'heart-fill' : 'heart'} size={16} />
          </button>

      <div className={s.meta}>
        <div className={s.topRow}>
          <FoodMark type={product.foodType} />
          {product.unit ? <span className={s.unit}>{product.unit}</span> : null}
        </div>

        <Link href={`/products/${product.slug}`} className={`${s.name} clamp-2`}>
          {name(product)}
        </Link>

        {product.rating || product.ratingLabel ? (
          <div className={s.rate}>
            {product.rating ? <Rating value={product.rating} count={product.ratingCount} size={11.5} /> : null}
            {/* The admin's own badge, e.g. "5L+ sold". */}
            {product.ratingLabel ? <span className={s.rateLabel}>{product.ratingLabel}</span> : null}
          </div>
        ) : null}

        {days > 1 ? (
          <span className={s.days}>Delivery in {days} days</span>
        ) : days === 1 ? (
          <span className={s.days}>Next day delivery</span>
        ) : null}

        <div className={s.buy}>
          <div>
            <Price price={product.price} mrp={product.mrp} size={15} />
            {save > 0 ? <span className={s.save}>Save ₹{save}</span> : null}
          </div>
          {product.inStock && options && qty === 0 ? (
            optionsAdd
          ) : product.inStock ? (
          <QuantityStepper
            size="sm"
            quantity={qty}
            busy={false}
            disabled={!product.inStock}
            onAdd={() => act(() => addItem(product.id, 1, product))}
            onIncrement={() => act(() => updateItem(product.id, qty + 1))}
            onDecrement={() => act(() => updateItem(product.id, qty - 1))}
          />
          ) : (
            <NotifyMeButton productId={product.id} />
          )}
        </div>
      </div>
      {sizesSheet}
    </article>
  );
}

export function ProductCardSkeleton({ width }: { width?: number }) {
  return (
    <div style={{ width: width ?? '100%' }}>
      <div className={`sk ${s.skArt}`} />
      <div className="sk" style={{ height: 11, width: '40%', marginTop: 10 }} />
      <div className="sk" style={{ height: 13, width: '85%', marginTop: 8 }} />
      <div className="sk" style={{ height: 13, width: '60%', marginTop: 6 }} />
      {/* Proportional rather than fixed: 54px + 78px could not fit a column on
          the narrowest phones and pushed the whole grid wider than the screen. */}
      <div className={s.skRow}>
        <div className="sk" style={{ height: 18, width: '38%' }} />
        <div className="sk" style={{ height: 34, width: '55%', borderRadius: 'var(--r-sm)' }} />
      </div>
    </div>
  );
}
