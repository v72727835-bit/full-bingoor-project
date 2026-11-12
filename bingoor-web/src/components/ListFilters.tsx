'use client';

import React, { useEffect, useId, useState } from 'react';
import { fetchBrands } from '../api/catalog';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import s from './ListFilters.module.css';

export interface FilterState {
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  minRating?: number;
  foodType?: 'veg' | 'nonveg';
  inStock?: boolean;
}

export type PriceSort = 'off' | 'asc' | 'desc';

const PRICE_BANDS: [string, number | undefined, number | undefined][] = [
  ['Under ₹100', undefined, 100],
  ['₹100 – ₹300', 100, 300],
  ['₹300 – ₹500', 300, 500],
  ['₹500 – ₹1000', 500, 1000],
  ['Over ₹1000', 1000, undefined],
];

const DEFAULT_FILTERS = [
  { key: 'brand', label: 'Brand', kind: 'brand' as const },
  { key: 'price', label: 'Price', kind: 'price' as const },
  { key: 'discount', label: 'Discount', kind: 'discount' as const },
  { key: 'rating', label: 'Customer rating', kind: 'rating' as const },
  { key: 'diet', label: 'Veg / Non-veg', kind: 'diet' as const },
  { key: 'stock', label: 'In stock only', kind: 'stock' as const },
];

/**
 * The filter panel: one block per filter the admin left on, in the admin's
 * order and under the admin's names - the same panel sits down the left of
 * the page on desktop and in a drawer on phones. The price sort is its own
 * block: a vertical stick, LOW at the top and HIGH at the bottom, with an
 * on/off switch.
 */
export function ListFilters({
  category,
  value,
  onChange,
  priceSort,
  onPriceSort,
}: {
  category?: string;
  value: FilterState;
  onChange: (next: FilterState) => void;
  priceSort: PriceSort;
  onPriceSort: (next: PriceSort) => void;
}) {
  const settings = useSettings();
  const { t } = useLanguage();
  const filters = settings?.filters?.length ? settings.filters : DEFAULT_FILTERS;
  const sortOn = settings?.priceSortEnabled !== false;
  const [brands, setBrands] = useState<string[]>([]);
  // The panel is mounted twice (sidebar + phone drawer); each copy needs its own radio
  // group names, or the browser links them and a tap never changes the selection.
  const uid = useId();

  useEffect(() => {
    if (!filters.some((f) => f.kind === 'brand')) return;
    fetchBrands(category).then(setBrands).catch(() => setBrands([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className={s.panel}>
      {sortOn ? (
        <section className={s.block}>
          <div className={s.head}>
            <h3>{t('sortBy')} {t('price').toLowerCase()}</h3>
            <button
              type="button"
              role="switch"
              aria-checked={priceSort !== 'off'}
              aria-label="Turn price sorting on or off"
              className={s.switch}
              data-on={priceSort !== 'off'}
              onClick={() => onPriceSort(priceSort === 'off' ? 'asc' : 'off')}
            >
              <span />
            </button>
          </div>
          <div className={s.stick} data-off={priceSort === 'off'}>
            <span className={s.rod} aria-hidden="true" />
            <button type="button" className={s.end} data-on={priceSort === 'asc'} onClick={() => onPriceSort('asc')}>
              <b>{t('lowToHigh')}</b>
              <small>Lowest price on top</small>
            </button>
            <button type="button" className={s.end} data-on={priceSort === 'desc'} onClick={() => onPriceSort('desc')}>
              <b>{t('highToLow')}</b>
              <small>Highest price on top</small>
            </button>
          </div>
        </section>
      ) : null}

      {filters.map((f) => {
        switch (f.kind) {
          case 'brand':
            return brands.length ? (
              <section key={f.key} className={s.block}>
                <h3>{f.label}</h3>
                <div className={s.opts}>
                  {brands.map((b) => (
                    <label key={b} className={s.opt}>
                      <input type="radio" name={`brand-${f.key}-${uid}`} checked={value.brand === b} onChange={() => set({ brand: b })} />
                      {b}
                    </label>
                  ))}
                </div>
              </section>
            ) : null;
          case 'price':
            return (
              <section key={f.key} className={s.block}>
                <h3>{f.label}</h3>
                <div className={s.opts}>
                  {PRICE_BANDS.map(([label, min, max]) => (
                    <label key={label} className={s.opt}>
                      <input
                        type="radio"
                        name={`price-${f.key}-${uid}`}
                        checked={value.minPrice === min && value.maxPrice === max}
                        onChange={() => set({ minPrice: min, maxPrice: max })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </section>
            );
          case 'discount':
            return (
              <section key={f.key} className={s.block}>
                <h3>{f.label}</h3>
                <div className={s.opts}>
                  {[10, 20, 30, 50].map((d) => (
                    <label key={d} className={s.opt}>
                      <input type="radio" name={`disc-${f.key}-${uid}`} checked={value.minDiscount === d} onChange={() => set({ minDiscount: d })} />
                      {d}% or more
                    </label>
                  ))}
                </div>
              </section>
            );
          case 'rating':
            return (
              <section key={f.key} className={s.block}>
                <h3>{f.label}</h3>
                <div className={s.opts}>
                  {[4, 3].map((r) => (
                    <label key={r} className={s.opt}>
                      <input type="radio" name={`rate-${f.key}-${uid}`} checked={value.minRating === r} onChange={() => set({ minRating: r })} />
                      {r}★ &amp; above
                    </label>
                  ))}
                </div>
              </section>
            );
          case 'diet':
            return (
              <section key={f.key} className={s.block}>
                <h3>{f.label}</h3>
                <div className={s.opts}>
                  {(
                    [
                      ['veg', 'Veg'],
                      ['nonveg', 'Non-veg'],
                    ] as const
                  ).map(([v, label]) => (
                    <label key={v} className={s.opt}>
                      <input type="radio" name={`diet-${f.key}-${uid}`} checked={value.foodType === v} onChange={() => set({ foodType: v })} />
                      {label}
                    </label>
                  ))}
                </div>
              </section>
            );
          case 'stock':
            return (
              <section key={f.key} className={s.block}>
                <label className={s.opt}>
                  <input type="checkbox" checked={!!value.inStock} onChange={(e) => set({ inStock: e.target.checked || undefined })} />
                  {f.label}
                </label>
              </section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
