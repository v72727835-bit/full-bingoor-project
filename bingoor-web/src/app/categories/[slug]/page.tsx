'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { fetchCategory } from '../../../api/catalog';
import { POINT_EVENT } from '../../../lib/deliveryPoint';
import { useLanguage } from '../../../context/LanguageContext';
import { useCart } from '../../../context/CartContext';
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
  // The site header is hidden on phones here, so this bar carries the cart count.
  const { cart } = useCart();
  const cartCount = cart?.itemCount ?? 0;

  // On a phone this page has its own title bar, so the site header steps aside.
  useEffect(() => {
    document.documentElement.dataset.catMobile = '1';
    return () => {
      delete document.documentElement.dataset.catMobile;
    };
  }, []);

  useEffect(() => {
    setCategory(null);
    const load = () =>
      fetchCategory(slug)
        .then(setCategory)
        .catch(() => setCategory(null));
    load();
    window.addEventListener(POINT_EVENT, load);
    return () => window.removeEventListener(POINT_EVENT, load);
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
        <Link
          href="/cart"
          className={`${s.mBack} ${s.mCart}`}
          aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount > 1 ? 's' : ''}` : 'Cart'}
        >
          <Icon name="cart" size={22} />
          {cartCount > 0 ? (
            <span key={cartCount} className={`num ${s.mCartBadge}`} aria-hidden>
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          ) : null}
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
              <p className="body-sm">From a warehouse near you, delivered in minutes</p>
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
        <ProductListView
          base={{ category: slug }}
          tint={category?.tint}
          compact
          aside={
            rail.length > 0 ? (
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
            ) : (
              // No aisles to list: the column still holds the filters on desktop.
              <span />
            )
          }
        />
      </div>
    </div>
  );
}
