'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { fetchCategory } from '../../../api/catalog';
import { useLanguage } from '../../../context/LanguageContext';
import { fitClass } from '../../../lib/art';
import { Category } from '../../../lib/types';
import { BackButton } from '../../../components/BackButton';
import { Crumbs } from '../../../components/Crumbs';
import { Icon } from '../../../components/Icon';
import { SearchBar } from '../../../components/SearchBar';
import { ProductListView } from '../../../components/ProductListView';
import { ShareButtons } from '../../../components/ShareButtons';
import s from '../categories.module.css';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { name } = useLanguage();
  const [category, setCategory] = useState<Category | null>(null);
  const router = useRouter();

  // On a phone this page has its own title bar, so the site header steps aside.
  useEffect(() => {
    document.documentElement.dataset.catMobile = '1';
    return () => {
      delete document.documentElement.dataset.catMobile;
    };
  }, []);

  useEffect(() => {
    setCategory(null);
    fetchCategory(slug)
      .then(setCategory)
      .catch(() => setCategory(null));
  }, [slug]);

  const tile = category?.tint
    ? `color-mix(in srgb, ${category.tint} var(--tint-mix), var(--surface))`
    : 'var(--brand-tint)';

  // The aisle rail: this aisle's own child aisles (Blinkit style), else the aisles beside it.
  const kids = category?.children ?? [];
  const rail = category ? (kids.length > 0 ? [category, ...kids] : category.siblings ?? []) : [];
  const heading = category && kids.length === 0 && category.siblings && category.siblings.length > 0 && category.parentCategory ? category.parentCategory : category;
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/categories');
  };

  return (
    <div className="page">
      <div className={s.mBar}>
        <button type="button" className={s.mBack} onClick={goBack} aria-label="Back">
          <Icon name="chevron-left" size={22} />
        </button>
        <h1 className={s.mTitle}>{heading ? name(heading) : '…'}</h1>
        <Link href="/cart" className={s.mBack} aria-label="Cart">
          <Icon name="cart" size={22} />
        </Link>
      </div>
      <div className={s.mSearch}>
        <SearchBar variant="plain" />
      </div>

      <div className={s.topBar}>
        <BackButton fallback="/categories" />
        <Crumbs trail={[{ label: 'Categories', href: '/categories' }, { label: category?.name ?? '…' }]} />
      </div>

      <header className={s.head}>
        <span className={s.art} style={{ ['--tile' as string]: tile }}>
          {category ? (
            <Image src={category.image || category.art} alt="" width={64} height={64} className={fitClass(category.image, s.artImg)} unoptimized />
          ) : null}
        </span>
        <div style={{ minWidth: 0 }}>
          {category ? (
            <>
              <h1 className="h1">{name(category)}</h1>
              <p className="body-sm">From shops near you, delivered in minutes</p>
            </>
          ) : (
            <>
              <div className="sk" style={{ height: 26, width: 200 }} />
              <div className="sk" style={{ height: 13, width: 260, marginTop: 8 }} />
            </>
          )}
        </div>
        {category ? <ShareButtons title={category.name} compact /> : null}
      </header>

      <div className={s.catBody}>
        {rail.length > 0 ? (
          <nav className={s.sideRail} aria-label="Aisles">
            {rail.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`} className={s.railItem} data-active={c.slug === slug}>
                <span className={s.railFrame}>
                  <Image src={c.image || c.art} alt="" width={56} height={56} className={fitClass(c.image, s.railArt)} unoptimized />
                </span>
                <span className={s.railName}>{kids.length > 0 && c.slug === slug ? 'All' : name(c)}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        <div className={s.catMain}>
          <ProductListView base={{ category: slug }} tint={category?.tint} compact />
        </div>
      </div>
    </div>
  );
}
