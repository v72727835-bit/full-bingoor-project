'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { fetchPointsProducts } from '../../../api/catalog';
import { BackButton } from '../../../components/BackButton';
import { Icon } from '../../../components/Icon';
import { ProductCard, ProductCardSkeleton } from '../../../components/ProductCard';
import { Alert, EmptyState } from '../../../components/ui';
import { useCart } from '../../../context/CartContext';
import { getErrorMessage } from '../../../lib/client';
import { Product } from '../../../lib/types';

/** #35: "See all products" from the cart - every product picked for the cart rows, mixed, in sort-code order. */
export default function CartMorePage() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState('');
  const { cart } = useCart();

  useEffect(() => {
    fetchPointsProducts()
      .then(setItems)
      .catch((e) => {
        setError(getErrorMessage(e));
        setItems([]);
      });
  }, []);

  const ready = cart ? cart.points.met : false;

  return (
    <div className="page rise" style={{ paddingTop: 18 }}>
      <BackButton fallback="/cart" />
      <h1 className="h1" style={{ margin: '10px 0 4px' }}>
        Add one to continue
      </h1>
      <p className="body-sm" style={{ marginBottom: 18 }}>
        Add any one of these to your cart, then go back and proceed to payment.
      </p>
      {ready ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="ok">
            You can proceed to payment now.{' '}
            <Link href="/cart" style={{ fontWeight: 700 }}>
              Go to cart <Icon name="arrow-right" size={14} />
            </Link>
          </Alert>
        </div>
      ) : null}
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {!items ? (
        <div className="grid-products">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="cart" title="Nothing here right now" body="Go back to your cart and continue." action={<Link href="/cart" className="btn btn-md btn-primary">Back to cart</Link>} />
      ) : (
        <div className="grid-products">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
