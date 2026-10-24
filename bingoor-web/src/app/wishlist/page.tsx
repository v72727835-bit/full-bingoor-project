'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { fetchWishlist } from '../../api/account';
import { getErrorMessage } from '../../lib/client';
import { Product } from '../../lib/types';
import { Crumbs } from '../../components/Crumbs';
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard';
import { RequireAuth } from '../../components/RequireAuth';
import { Alert, EmptyState } from '../../components/ui';

function WishlistInner() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWishlist()
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div className="page rise">
      <Crumbs trail={[{ label: 'Account', href: '/profile' }, { label: 'Wishlist' }]} />
      <h1 className="h1" style={{ marginBottom: 4 }}>
        Your wishlist
      </h1>
      <p className="body-sm" style={{ marginBottom: 24 }}>
        Items you saved for later
      </p>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      {!items ? (
        <div className="grid-products">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Your wishlist is empty"
          body="Tap the heart on any product and it will appear here."
          action={
            <Link href="/" className="btn btn-md btn-primary">
              Browse products
            </Link>
          }
        />
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

export default function WishlistPage() {
  return (
    <RequireAuth>
      <WishlistInner />
    </RequireAuth>
  );
}
