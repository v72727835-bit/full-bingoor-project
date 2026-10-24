'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { fetchFestival } from '../../api/catalog';
import { Icon } from '../../components/Icon';
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard';
import { Rail } from '../../components/Rail';
import { Alert, Button, SectionHead } from '../../components/ui';
import { getErrorMessage } from '../../lib/client';
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
  useEffect(load, []);

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
          <Rail>
            {section.items.map((p) => (
              <ProductCard key={p.id} product={p} width={168} tint={section.category.tint} />
            ))}
          </Rail>
          {/* Straight into the aisle, where every child category is listed. */}
          <Link href={`/categories/${section.category.slug}`} className={s.seeAll}>
            See all {section.category.name}
            <Icon name="arrow-right" size={16} />
          </Link>
        </section>
      ))}
    </div>
  );
}
