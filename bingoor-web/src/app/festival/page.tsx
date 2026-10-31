'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { fetchFestival } from '../../api/catalog';
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard';
import { Rail } from '../../components/Rail';
import { Alert, Button, SectionHead, SeeAll } from '../../components/ui';
import { getErrorMessage } from '../../lib/client';
import { POINT_EVENT } from '../../lib/deliveryPoint';
import { FestivalPage } from '../../lib/types';
import s from './festival.module.css';

/**
 * The festival tab (Rakhi, Diwali, …).
 *
 * A cover banner, then one row per aisle the admin picked. Each row shows the
 * first products with a "See all" that opens the aisle, so the page is laid
 * out like the home feed and needs no release when the festival changes.
 */
export default function FestivalTab() {
  const [page, setPage] = useState<FestivalPage | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    fetchFestival()
      .then((p) => {
        setPage(p);
        setError('');
      })
      .catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(() => {
    load();
    // The rows depend on where the customer is (far customers see only the admin's picks, point 37).
    window.addEventListener(POINT_EVENT, load);
    return () => window.removeEventListener(POINT_EVENT, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !page) {
    return (
      <div className="page" style={{ paddingTop: 28, maxWidth: 560 }}>
        <Alert tone="bad">{error}</Alert>
        <Button onClick={load} icon="repeat">
          Try again
        </Button>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="page" style={{ paddingTop: 20 }}>
        <div className={s.bannerSkeleton} />
        <div className="grid-products">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!page.enabled || page.sections.length === 0) {
    return (
      <div className="page" style={{ paddingTop: 28, maxWidth: 560 }}>
        <h1 className="h1">{page.name}</h1>
        <p className="body-sm" style={{ marginTop: 8 }}>
          Nothing here just yet. Come back soon for the {page.name.toLowerCase()} picks.
        </p>
      </div>
    );
  }

  return (
    <div className="page rise" style={{ paddingTop: 16 }}>
      {page.banner ? (
        <div className={s.banner}>
          <Image src={page.banner} alt={page.name} width={1040} height={360} className="photo-fill" unoptimized priority />
        </div>
      ) : (
        <h1 className={`h1 ${s.title}`}>{page.name}</h1>
      )}

      {page.sections.map((section) => (
        <section key={section.category.id} className={s.section}>
          <SectionHead title={section.title || section.category.name} />
          {/* Points 14 / 27: the short card, 3 across on a phone, the row slides for the rest. */}
          <Rail className={s.peekRail}>
            {section.items.map((p) => (
              <ProductCard key={p.id} product={p} compact tint={section.category.tint} />
            ))}
          </Rail>
          {/* Straight into the aisle, where every child category is listed, with a peek at the first products. */}
          <div className={s.seeAll}>
            <SeeAll
              href={`/categories/${section.category.slug}`}
              previews={section.items.map((p) => p.photo)}
              label={`See all ${section.category.name}`}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
