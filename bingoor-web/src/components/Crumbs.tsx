'use client';

import Link from 'next/link';
import React from 'react';
import { Icon } from './Icon';
import s from './Crumbs.module.css';

export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav className={s.cr} aria-label="Breadcrumb">
      <Link href="/" className={s.link}>
        Home
      </Link>
      {trail.map((t) => (
        <React.Fragment key={t.label + (t.href ?? '')}>
          <Icon name="chevron-right" size={13} />
          {t.href ? (
            <Link href={t.href} className={`${s.link} clamp-1`}>
              {t.label}
            </Link>
          ) : (
            <span className={`${s.now} clamp-1`}>{t.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
