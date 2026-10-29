'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Product } from '../lib/types';
import { getErrorMessage } from '../lib/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Icon } from './Icon';
import { useLanguage } from '../context/LanguageContext';
import { fitClass } from '../lib/art';
import { useToast } from '../context/ToastContext';
import { NotifyMeButton } from './NotifyMe';
import { QuantityStepper } from './QuantityStepper';
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
  const { show } = useToast();
  const router = useRouter();
  const wishlist = useWishlist();
  const wished = wishlist.has(product.id);
  const toggleWish = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Tell the customer what happened — the heart alone is easy to miss.
    const wasWished = wished;
    act(async () => {
      await wishlist.toggle(product.id);
      show(wasWished ? 'Product is removed from wish list' : 'Product is added to wish list', 'success');
    });
  };
  const save = Math.max(0, Math.round((product.mrp ?? 0) - product.price));
  const [busy, setBusy] = useState(false);

  const qty = quantityOf(product.id);

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
          {product.inStock ? (
            <QuantityStepper
              size="sm"
              quantity={qty}
              busy={busy}
              onAdd={() => act(() => addItem(product.id, 1))}
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
          {product.variants && product.variants.length > 0 ? (
            <Link href={`/products/${product.slug}`} className={s.cOptions}>
              See options ›
            </Link>
          ) : null}
        </div>
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

        {product.deliveryDays && product.deliveryDays > 1 ? (
          <span className={s.days}>Delivery in {product.deliveryDays} days</span>
        ) : null}

        <div className={s.buy}>
          <div>
            <Price price={product.price} mrp={product.mrp} size={15} />
            {save > 0 ? <span className={s.save}>Save ₹{save}</span> : null}
          </div>
          {product.inStock ? (
          <QuantityStepper
            size="sm"
            quantity={qty}
            busy={busy}
            disabled={!product.inStock}
            onAdd={() => act(() => addItem(product.id, 1))}
            onIncrement={() => act(() => updateItem(product.id, qty + 1))}
            onDecrement={() => act(() => updateItem(product.id, qty - 1))}
          />
          ) : (
            <NotifyMeButton productId={product.id} />
          )}
        </div>
      </div>
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
