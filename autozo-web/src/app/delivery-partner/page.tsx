'use client';

import Link from 'next/link';
import React from 'react';
import { FORMS } from '../../lib/pages';

import s from '../static.module.css';

export default function Page() {
  return (
    <div className={`page rise ${s.wrap}`}>
      <h1 className="h1">Bingoor Delivery Partner</h1>
      <p className="body-sm" style={{ margin: '4px 0 22px' }}>Earn by delivering groceries in your own neighbourhood.</p>
      <section className="card card-pad">
        <h2 className="h3">Why deliver with Bingoor</h2>
        <ul className={s.list}>
          <li>Short routes from a local warehouse</li>
          <li>Clear earnings and a cash-handling process you can trust</li>
          <li>A simple app: accept, navigate, deliver with an OTP</li>
        </ul>
        <Link href="/contact/delivery-partner" className="btn btn-md btn-primary">Apply to deliver</Link>
      </section>
    </div>
  );
}
