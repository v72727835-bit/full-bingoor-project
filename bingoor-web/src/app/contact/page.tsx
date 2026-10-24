'use client';

import React from 'react';
import { Crumbs } from '../../components/Crumbs';
import { Icon } from '../../components/Icon';
import { Alert } from '../../components/ui';
import { FORMS } from '../../lib/pages';
import Link from 'next/link';
import s from './contactIndex.module.css';

export default function ContactPage() {
  return (
    <div className="page rise">
      <Crumbs trail={[{ label: 'Contact us' }]} />

      <header className={s.head}>
        <h1 className="h1">Contact us</h1>
        <p className="body-sm">We are here to help with orders, deliveries and anything else.</p>
      </header>

      <Alert tone="bad">
        Be cautious: A Bingoor representative would never request bank information, such as account number, UPI pin,
        CVV, OTP, or card data, from strangers posing as Bingoor.
      </Alert>

      <Alert tone="brand" icon="phone">
        Watch out for phony numbers! Please only use our in-app assistance, where we are available, if you have any
        problems.
      </Alert>

      <div className={s.grid}>
        <section className={`card ${s.block}`}>
          <span className={s.icon}>
            <Icon name="store" size={18} />
          </span>
          <h2 className={s.blockTitle}>Registered office</h2>
          <address className={s.address}>
            AUAXI AID
            <br />
            First floor, 35 A, Shyam Nagar 3rd,
            <br />
            Mangalam Ananda Road,
            <br />
            Jaipur, Rajasthan – 302029
          </address>
          <dl className={s.facts}>
            <div className={s.fact}>
              <dt>GSTIN</dt>
              <dd className="num">08BPNPC9732A1ZZ</dd>
            </div>
          </dl>
        </section>

        <section className={`card ${s.block}`}>
          <span className={s.icon}>
            <Icon name="phone" size={18} />
          </span>
          <h2 className={s.blockTitle}>Write to us</h2>
          <p className={s.body}>
            Email us and our support team will get back to you. For anything about a live order, in-app assistance is
            the fastest route.
          </p>
          <a href="mailto:info@bingoor.com" className="btn btn-md btn-primary">
            info@bingoor.com
          </a>
        </section>
      </div>

      <section className={s.forms}>
        <h2 className={s.pitchTitle}>Reach the right team</h2>
        <div className={s.formGrid}>
          {FORMS.map((f) => (
            <Link key={f.slug} href={`/contact/${f.slug}`} className={`card card-hover ${s.formCard}`}>
              <span className={s.formTitle}>{f.title}</span>
              <span className={s.formLead}>{f.lead}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={s.pitch}>
        <h2 className={s.pitchTitle}>#1 instant delivery service in India</h2>
        <p className={s.body}>
          Get anything delivered right to your door while you shop on the move. Purchase a wide range of goods,
          including groceries, fresh produce, cakes and baked goods, meats and seafood, cosmetics, cell phones and
          accessories, electronics, baby care products, and much more. We bring everything to your home as quickly and
          safely as we can.
        </p>

        <h2 className={s.pitchTitle}>A single app for all your daily needs</h2>
        <p className={s.body}>
          With just a tap, you can order thousands of products from your local stores, including milk, eggs, bread,
          cooking oil, ghee, atta, rice, fresh fruits and vegetables, spices, chocolates, chips, biscuits, noodles, cold
          drinks, shampoos, soaps, body wash, pet food, nappies, electronics, and much more.
        </p>
      </section>
    </div>
  );
}
