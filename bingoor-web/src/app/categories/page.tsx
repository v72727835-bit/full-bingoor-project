'use client';

import React, { useEffect, useState } from 'react';
import { fetchCategoryTree } from '../../api/catalog';
import { getErrorMessage } from '../../lib/client';
import { Category } from '../../lib/types';
import { CategoryTile } from '../../components/CategoryTile';
import { Crumbs } from '../../components/Crumbs';
import { Alert, SectionHead } from '../../components/ui';
import s from './categories.module.css';

export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategoryTree()
      .then(setTree)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div className="page">
      <Crumbs trail={[{ label: 'Categories' }]} />
      <h1 className="h1" style={{ marginBottom: 6 }}>
        All categories
      </h1>
      <p className="body-sm" style={{ marginBottom: 28 }}>
        From groceries to personal care — everything in one place.
      </p>

      {error ? <Alert tone="bad">{error}</Alert> : null}

      {!tree
        ? Array.from({ length: 3 }).map((_, g) => (
            <div key={g} className={s.group}>
              <div className="sk" style={{ height: 20, width: 190, marginBottom: 16 }} />
              <div className="grid-cats">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i}>
                    <div className={`sk ${s.skTile}`} />
                    <div className={`sk ${s.skLabel}`} />
                  </div>
                ))}
              </div>
            </div>
          ))
        : tree.map((group) => {
            const kids = group.children?.length ? group.children : [group];
            return (
              <section key={group.id} className={s.group}>
                <SectionHead title={titleCase(group.name)} />
                <div className="grid-cats">
                  {kids.map((c) => (
                    <CategoryTile key={c.id} category={c} />
                  ))}
                </div>
              </section>
            );
          })}
    </div>
  );
}

function titleCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/(^|\s|&\s)([a-z])/g, (_, p, c) => p + c.toUpperCase());
}
