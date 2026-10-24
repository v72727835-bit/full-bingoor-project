'use client';

import Link from 'next/link';
import React from 'react';
import { FORMS } from '../../lib/pages';

import s from '../static.module.css';

export default function Page() {
  return (
    <div className={`page rise ${s.wrap}`}>
      <h1 className="h1">Bingoor Seller Partner</h1>
      <p className="body-sm" style={{ margin: '4px 0 22px' }}>List your products on Bingoor and reach customers nearby.</p>
      <section className="card card-pad">
        <h2 className="h3">How it works</h2>
        <ol className={s.list}>
          <li>Register your warehouse with the form below.</li>
          <li>The Bingoor team reviews and approves it.</li>
          <li>Sign in at the warehouse panel, list your products and send orders to riders.</li>
        </ol>
        <Link href="/warehouse-register" className="btn btn-md btn-primary">Register your warehouse</Link>
      </section>
    </div>
  );
}
