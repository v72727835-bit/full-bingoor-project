'use client';

import Link from 'next/link';
import React from 'react';
import { FORMS } from '../../lib/pages';

import s from '../static.module.css';

export default function Page() {
  return (
    <div className={`page rise ${s.wrap}`}>
      <h1 className="h1">Blog</h1>
      <p className="body-sm" style={{ margin: '4px 0 22px' }}>Stories from the Bingoor kitchen, shelves and neighbourhood.</p>
      <div className={s.grid}>
        {[
          ['How we deliver in minutes', 'A look at the local warehouse, the riders and the route that gets your order to you fast.'],
          ['Fresh fruit and vegetables: how we pick', 'What we check before a fruit or vegetable reaches your cart.'],
          ['Festival shopping, made easy', 'Plan your festival basket early and get it delivered to your door.'],
        ].map(([t, b]) => (
          <article key={t} className="card card-pad">
            <h2 className="h3">{t}</h2>
            <p className="body-sm" style={{ marginTop: 8 }}>{b}</p>
            <span className="body-sm">Coming soon</span>
          </article>
        ))}
      </div>
    </div>
  );
}
