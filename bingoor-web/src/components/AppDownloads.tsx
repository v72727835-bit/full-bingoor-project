'use client';

import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../lib/config';
import { Icon } from './Icon';
import s from './AppDownloads.module.css';

/** Where the server publishes the latest APKs (deploy/docker-deploy.sh). */
const DOWNLOADS = `${API_URL.replace(/\/api\/v\d+\/?$/, '')}/downloads`;

/**
 * The three Bingoor Android apps, just above the footer. Each link is the
 * latest APK on our server; a link the admin saved under app links wins.
 */
export function AppDownloads() {
  const links = useSettings()?.appLinks ?? {};
  const apps = [
    {
      key: 'customer',
      name: 'Bingoor',
      who: 'For shoppers',
      line: 'Order groceries and daily needs, track your delivery live.',
      href: links.android || `${DOWNLOADS}/bingoor-customer.apk`,
    },
    {
      key: 'rider',
      name: 'Bingoor Rider',
      who: 'For delivery partners',
      line: 'Get new pickups with a loud bell, deliver with the customer OTP.',
      href: links.rider || `${DOWNLOADS}/bingoor-rider.apk`,
    },
    {
      key: 'warehouse',
      name: 'Bingoor Warehouse',
      who: 'For sellers',
      line: 'Manage orders, products, stock and your riders.',
      href: links.warehouse || `${DOWNLOADS}/bingoor-warehouse.apk`,
    },
  ];

  return (
    <section className={s.wrap} aria-labelledby="app-downloads-title">
      <div className="page">
        <div className={s.head}>
          <h2 id="app-downloads-title" className={s.title}>
            Get the Bingoor apps
          </h2>
          <p className={s.sub}>Free Android apps. Tap to download, then open the file to install.</p>
        </div>
        <div className={s.grid}>
          {apps.map((a) => (
            <a key={a.key} href={a.href} className={s.card} download rel="noopener">
              <img src={`/apps/${a.key}.png`} alt="" width={56} height={56} className={s.icon} />
              <span className={s.text}>
                <small className={s.who}>{a.who}</small>
                <b className={s.name}>{a.name}</b>
                <span className={s.line}>{a.line}</span>
              </span>
              <span className={s.btn}>
                <Icon name="android" size={16} />
                Download
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
