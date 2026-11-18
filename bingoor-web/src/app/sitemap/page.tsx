'use client';

import Link from 'next/link';
import React from 'react';
import { FORMS } from '../../lib/pages';

import s from '../static.module.css';

export default function Page() {
  return (
    <div className={`page rise ${s.wrap}`}>
      <h1 className="h1">Sitemap</h1>
      <p className="body-sm" style={{ margin: '4px 0 22px' }}>Everything on Bingoor in one place.</p>
      <div className={s.grid}>
        <section className="card card-pad">
          <h2 className="h3">Warehouse</h2>
          <ul className={s.list}>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/categories">All categories</Link></li>
            <li><Link href="/search">Search</Link></li>
            <li><Link href="/wishlist">Wishlist</Link></li>
            <li><Link href="/cart">Cart</Link></li>
          </ul>
        </section>
        <section className="card card-pad">
          <h2 className="h3">Account</h2>
          <ul className={s.list}>
            <li><Link href="/orders">My orders</Link></li>
            <li><Link href="/addresses">Addresses</Link></li>
            <li><Link href="/profile">Profile</Link></li>
            <li><Link href="/support">Chat with customer care</Link></li>
          </ul>
        </section>
        <section className="card card-pad">
          <h2 className="h3">Company</h2>
          <ul className={s.list}>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/gallery">Gallery</Link></li>
            <li><Link href="/videos">Videos</Link></li>
            <li><Link href="/delivery-partner">Bingoor Delivery Partner</Link></li>
            <li><Link href="/seller-partner">Bingoor Seller Partner</Link></li>
            <li><Link href="/help">Help & Support</Link></li>
          </ul>
        </section>
        <section className="card card-pad">
          <h2 className="h3">Contact forms</h2>
          <ul className={s.list}>
            {FORMS.map((f) => (
              <li key={f.slug}><Link href={`/contact/${f.slug}`}>{f.title}</Link></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
