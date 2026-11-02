'use client';

import Link from 'next/link';
import React from 'react';
import { useCatalog } from '../context/CatalogContext';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { DESKTOP_PAGES, FORMS, LEGAL_PAGES } from '../lib/pages';
import { Icon } from './Icon';
import { LanguageMenu } from './LanguageMenu';
import { InstallAppButton } from './InstallAppButton';
import { AppDownloads } from './AppDownloads';
import s from './Footer.module.css';

/**
 * A grocery-app footer in the Blinkit / Zepto mould: the brand and its domain
 * on top, the aisles, the company pages and the contact forms in columns, and
 * the app links at the end. The company pages are desktop-only, as asked.
 */
const SOCIALS = [
  { key: 'facebook', label: 'Facebook', short: 'f' },
  { key: 'instagram', label: 'Instagram', short: 'ig' },
  { key: 'youtube', label: 'YouTube', short: '▶' },
  { key: 'whatsapp', label: 'WhatsApp', short: 'wa' },
  { key: 'x', label: 'X (Twitter)', short: 'X' },
  { key: 'telegram', label: 'Telegram', short: 'tg' },
  { key: 'linkedin', label: 'LinkedIn', short: 'in' },
] as const;

export function Footer() {
  const settings = useSettings();
  const { home } = useCatalog();
  const { name, t } = useLanguage();
  const apps = settings?.appLinks ?? {};
  // Social pages are set in the admin panel; only the ones that were filled in show up.
  const socials = [
    ...SOCIALS.filter((x) => settings?.socialLinks?.[x.key]).map((x) => ({ ...x, url: settings!.socialLinks![x.key]! })),
    ...(settings?.socialOther ?? []).map((x) => ({ key: `o-${x.label}`, label: x.label, short: x.label.slice(0, 2), url: x.url })),
  ];
  const aisles = (home?.topTabs ?? []).slice(0, 14);

  return (
    <>
    {/* The three Android apps sit just above the footer. */}
    <AppDownloads />
    <footer className={`${s.ft} ${s.afterApps}`}>
      <div className="page">
        <div className={s.top}>
          <div className={s.brand}>
            <div className={s.logo}>
              <img src="/logo-mark.png" alt="" width={44} height={44} className={s.mark} />
              <span className={s.word}>Bingoor</span>
            </div>
            <p className={s.tag}>Everyday essentials from shops in your neighbourhood, delivered to your door in minutes.</p>
            {settings?.supportPhone ? (
              <a href={`tel:${settings.supportPhone}`} className={s.call}>
                <Icon name="phone" size={15} />
                {t('needHelp')} <b>{settings.supportPhone}</b>
              </a>
            ) : null}
            {socials.length ? (
              <div className={s.social} aria-label="Follow us">
                {socials.map((x) => (
                  <a key={x.key} href={x.url} className={s.socBtn} target="_blank" rel="noopener noreferrer" aria-label={x.label} title={x.label}>
                    {x.short}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {apps.ios ? (
            <div className={s.apps}>
              <div className={s.colTitle}>Get the app</div>
              <div className={s.appRow}>
                <a href={apps.ios} className={s.store} target="_blank" rel="noopener noreferrer">
                  <Icon name="apple" size={20} />
                  <span>
                    <small>Download on</small>
                    iPhone
                  </span>
                </a>
              </div>
            </div>
          ) : null}

          {/* Always available (iPhone included): add the website to the home screen. */}
          <div className={s.apps}>
            <div className={s.colTitle}>Use it like an app</div>
            <InstallAppButton />
          </div>
        </div>

        <hr className="divider" />

        <div className={s.cols}>
          {/* Company pages: desktop only. */}
          <nav className={`${s.col} ${s.deskOnly}`} aria-label="Useful links">
            <div className={s.colTitle}>Useful links</div>
            {DESKTOP_PAGES.map((l) => (
              <Link key={l.href} href={l.href} className={s.colLink}>
                {l.label}
              </Link>
            ))}
          </nav>

          <nav className={`${s.col} ${s.wide}`} aria-label="Categories">
            <div className={s.colTitle}>{t('categories')}</div>
            <div className={s.catGrid}>
              {aisles.map((c) => (
                <Link key={c.id} href={`/categories/${c.slug}`} className={s.colLink}>
                  {name(c)}
                </Link>
              ))}
              <Link href="/categories" className={`${s.colLink} ${s.more}`}>
                {t('seeAll')}
              </Link>
            </div>
          </nav>

          <nav className={s.col} aria-label="Get in touch">
            <div className={s.colTitle}>Get in touch</div>
            {FORMS.map((f) => (
              <Link key={f.slug} href={`/contact/${f.slug}`} className={s.colLink}>
                {f.title}
              </Link>
            ))}
            <Link href="/warehouse-register" className={s.colLink}>
              Register your warehouse
            </Link>
          </nav>

          <nav className={s.col} aria-label="Legal">
            <div className={s.colTitle}>Legal</div>
            {LEGAL_PAGES.map((l) => (
              <Link key={l.href} href={l.href} className={s.colLink}>
                {l.label}
              </Link>
            ))}
          </nav>

          <nav className={s.col} aria-label="Account">
            <div className={s.colTitle}>{t('account')}</div>
            <Link href="/orders" className={s.colLink}>{t('myOrders')}</Link>
            <Link href="/addresses" className={s.colLink}>Addresses</Link>
            <Link href="/wishlist" className={s.colLink}>{t('wishlist')}</Link>
            <Link href="/support" className={s.colLink}>{t('support')}</Link>
            <Link href="/gallery" className={s.colLink}>Gallery</Link>
            <Link href="/videos" className={s.colLink}>Videos</Link>
          </nav>
        </div>

        <div className={s.base}>
          <span>© 2026 www.bingoor.com. All rights reserved.</span>
          <span className={s.baseTools}>
            <LanguageMenu upward />
          </span>
        </div>
      </div>
    </footer>
    </>
  );
}
