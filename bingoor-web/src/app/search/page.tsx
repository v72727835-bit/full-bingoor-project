'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { fetchShop } from '../../api/catalog';
import { Shop } from '../../lib/types';
import { useCatalog } from '../../context/CatalogContext';
import { CategoryCircle } from '../../components/CategoryTile';
import { Crumbs } from '../../components/Crumbs';
import { ProductListView } from '../../components/ProductListView';
import { SearchBar } from '../../components/SearchBar';
import { Badge, PageLoader, Rating } from '../../components/ui';
import s from './search.module.css';

function SearchInner() {
  const params = useSearchParams();
  const q = params.get('q') ?? undefined;
  const shopSlug = params.get('shop') ?? undefined;
  const { home } = useCatalog();
  const [shop, setShop] = useState<Shop | null>(null);

  useEffect(() => {
    if (!shopSlug) {
      setShop(null);
      return;
    }
    fetchShop(shopSlug)
      .then(setShop)
      .catch(() => setShop(null));
  }, [shopSlug]);

  const quick = home?.sections.find((sec) => sec.kind === 'circleRail');

  return (
    <div className="page">
      <Crumbs trail={[{ label: shop ? shop.name : q ? `“${q}”` : 'Search' }]} />

      <div className={s.searchTop}>
        <SearchBar variant="plain" />
      </div>

      {shop ? (
        <header className={s.shopHead}>
          <div className={s.shopTop}>
            <h1 className="h1">{shop.name}</h1>
            {shop.isOpen ? <Badge tone="ok">Open now</Badge> : <Badge tone="bad">Closed</Badge>}
          </div>
          {shop.description ? <p className="body-sm">{shop.description}</p> : null}
          <div className={s.shopFacts}>
            <Rating value={shop.rating} count={shop.ratingCount} />
            {shop.deliveryFee !== undefined ? (
              <span className="body-sm">
                {shop.deliveryFee === 0 ? 'Free delivery' : `₹${shop.deliveryFee} delivery`}
              </span>
            ) : null}
            {shop.minOrderAmount ? <span className="body-sm">₹{shop.minOrderAmount} minimum</span> : null}
          </div>
        </header>
      ) : q ? (
        <h1 className="h1" style={{ marginBottom: 4 }}>
          “{q}” — search results
        </h1>
      ) : null}

      {q || shopSlug ? (
        <ProductListView base={{ q, shop: shopSlug }} />
      ) : (
        <div className={s.idle}>
          <h1 className="h1" style={{ marginBottom: 6 }}>
            What are you looking for?
          </h1>
          <p className="body-sm" style={{ marginBottom: 26 }}>
            Start typing above, or pick a category below.
          </p>
          {quick && quick.kind === 'circleRail' ? (
            <div className={`rail ${s.idleRail}`}>
              {quick.items.map((c) => (
                <CategoryCircle key={c.id} category={c} />
              ))}
            </div>
          ) : null}
          <div className={s.idleAll}>
            <Link href="/categories" className="btn btn-md btn-outline">
              Browse all categories
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SearchInner />
    </Suspense>
  );
}
