'use client';

import Link from 'next/link';
import React from 'react';
import { FORMS } from '../../lib/pages';

import s from '../static.module.css';

export default function Page() {
  return (
    <div className={`page rise ${s.wrap}`}>
      <h1 className="h1">Help & Support</h1>
      <p className="body-sm" style={{ margin: '4px 0 22px' }}>Answers, and a way to reach us.</p>
      <section className="card card-pad">
        <h2 className="h3">Talk to us</h2>
        <p className="body-sm" style={{ margin: '6px 0 14px' }}>Start a chat with customer care from your profile, or write to the City manager.</p>
        <div className={s.row}>
          <Link href="/support" className="btn btn-md btn-primary">Chat with customer care</Link>
          <Link href="/contact/complaint" className="btn btn-md btn-outline">Complain to City manager</Link>
        </div>
      </section>
      <section className="card card-pad" style={{ marginTop: 16 }}>
        <h2 className="h3">Common questions</h2>
        <ul className={s.list}>
          <li><b>How fast is delivery?</b> Pick 19 minutes, 2 hours or next day at checkout. Some aisles take longer and say so on the product.</li>
          <li><b>Can I pay cash?</b> Yes, cash on delivery is available for most products and nearby addresses.</li>
          <li><b>My item is out of stock.</b> Tap it and choose “Notify me”; we will tell you when it is back.</li>
        </ul>
      </section>
    </div>
  );
}
