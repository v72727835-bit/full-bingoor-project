'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ListProductsParams, listProducts } from '../api/catalog';
import { getErrorMessage } from '../lib/client';
import { Product } from '../lib/types';
import { useLanguage } from '../context/LanguageContext';
import { Icon } from './Icon';
import { FilterState, ListFilters, PriceSort } from './ListFilters';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { Alert, Button, EmptyState, compact as fmt } from './ui';
import s from './ProductListView.module.css';

type Sort = NonNullable<ListProductsParams['sort']>;

const SORTS: { value: Sort; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

/** True on phone-width screens; false on the server and until the page has measured itself. */
function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 699px)');
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return phone;
}

export function ProductListView({
  base,
  tint,
  compact: wantsCompact,
  aside,
}: {
  base: ListProductsParams;
  tint?: string;
  /** The category layout: compact cards (the home rows' size) and the phone bar. */
  compact?: boolean;
  /**
   * Point 9: a column down the left (the child aisles). The filters go under
   * it on tablets and desktop, so the products get the full width beside it.
   */
  aside?: React.ReactNode;
}) {
  const phone = useIsPhone();
  const compact = !!wantsCompact;
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>('relevance');
  const [filters, setFilters] = useState<FilterState>({});
  const [priceSort, setPriceSort] = useState<PriceSort>('off');
  const [drawer, setDrawer] = useState(false);
  const { t } = useLanguage();
  const inStock = !!filters.inStock;
  const activeCount = Object.values(filters).filter((v) => v !== undefined).length + (priceSort !== 'off' ? 1 : 0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  const key = JSON.stringify(base);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setMore(true);
      setError('');
      try {
        const effectiveSort: Sort = priceSort === 'asc' ? 'price_asc' : priceSort === 'desc' ? 'price_desc' : sort;
        const res = await listProducts({ ...base, ...filters, sort: effectiveSort, inStock: inStock || undefined, page: p, limit: 24 });
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setHasNext(res.meta?.hasNext ?? false);
        setTotal(res.meta?.total ?? res.items.length);
        setPage(p);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    // `base` is compared by value through `key`, so a fresh object each
    // render doesn't retrigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, sort, inStock, JSON.stringify(filters), priceSort],
  );

  useEffect(() => {
    load(1, true);
  }, [load]);

  const filterPanel = (
    <ListFilters category={base.category} value={filters} onChange={setFilters} priceSort={priceSort} onPriceSort={setPriceSort} />
  );
  const top = (
    <>
      <div className={s.bar}>
        <span className={`body-sm ${s.count}`}>
          {total === null ? 'Loading…' : `${fmt(total)} ${total === 1 ? 'Item' : 'Items'}`}
        </span>
        <div className={s.controls}>
          <button className={`chip ${s.stockChip}`} data-active={inStock} onClick={() => setFilters((f) => ({ ...f, inStock: f.inStock ? undefined : true }))}>
            {inStock ? <Icon name="check" size={14} strokeWidth={2.4} /> : null}
            In stock only
          </button>
          <button className={`chip ${s.filterBtn}`} data-active={activeCount > 0} onClick={() => setDrawer((v) => !v)}>
            <Icon name="sliders" size={14} />
            {t('filters')}
            {activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <label>
            <span className="sr-only">Sort products</span>
            <select className={`input ${s.sort}`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {compact && phone && o.value === 'relevance' ? 'Sort' : o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      {activeCount > 0 ? (
        <div className={s.active}>
          {Object.entries(filters)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => (
              <button key={k} className="chip" data-active="true" onClick={() => setFilters((f) => ({ ...f, [k]: undefined }))}>
                {k === 'minPrice' ? `From ₹${v}` : k === 'maxPrice' ? `Up to ₹${v}` : k === 'minDiscount' ? `${v}%+ off` : k === 'minRating' ? `${v}★+` : k === 'inStock' ? 'In stock' : String(v)}
                <Icon name="x" size={12} />
              </button>
            ))}
          {priceSort !== 'off' ? (
            <button className="chip" data-active="true" onClick={() => setPriceSort('off')}>
              {priceSort === 'asc' ? t('lowToHigh') : t('highToLow')}
              <Icon name="x" size={12} />
            </button>
          ) : null}
          <button className="chip" onClick={() => { setFilters({}); setPriceSort('off'); }}>
            {t('clear')}
          </button>
        </div>
      ) : null}

    </>
  );
  const list = (
    <>
      {loading ? (
        <div className="grid-products">
          {Array.from({ length: 12 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="search"
          title="No products found"
          body="Try removing a filter or searching for something else."
          action={
            activeCount > 0 ? (
              <Button variant="outline" onClick={() => { setFilters({}); setPriceSort('off'); }}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid-products">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} tint={tint} compact={compact} />
            ))}
          </div>
          {hasNext ? (
            <div className={s.more}>
              <Button variant="outline" size="lg" loading={more} onClick={() => load(page + 1, false)}>
                Load more
              </Button>
            </div>
          ) : (
            <p className={`body-sm ${s.end}`}>That is everything — {fmt(items.length)} products shown.</p>
          )}
        </>
      )}
    </>
  );

  if (aside) {
    return (
      <div className={`${s.withAside} ${compact ? s.compact : ''}`}>
        <div className={s.asideCol}>
          {aside}
          {/* Desktop / tablet: the filters sit right under the aisle names. */}
          {phone ? null : <div className={s.asideFilters}>{filterPanel}</div>}
        </div>
        <div className={s.results}>
          {top}
          {phone && drawer ? <div className={s.drawer}>{filterPanel}</div> : null}
          {list}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? s.compact : undefined}>
      {top}
      <div className={s.layout}>
        <aside className={`${s.side} ${drawer ? s.sideOpen : ''}`}>{filterPanel}</aside>
        <div className={s.results}>{list}</div>
      </div>
    </div>
  );
}
