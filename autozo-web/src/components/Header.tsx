'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useWishlist } from '../context/WishlistContext';
import { getDeliveryPoint, POINT_EVENT } from '../lib/deliveryPoint';
import { OPEN_LOCATION_EVENT } from './LocationGate';
import { Icon } from './Icon';
import { shortDelivery } from '../lib/deliveryText';
import { LanguageMenu } from './LanguageMenu';
import { NoticeBell } from './NoticeBell';
import { SearchBar } from './SearchBar';
import s from './Header.module.css';

export function Header() {
  const { user } = useAuth();
  const { cart } = useCart();
  const { home } = useCatalog();
  const { count: saved } = useWishlist();
  const { theme, toggle } = useTheme();
  const settings = useSettings();
  const { t, name } = useLanguage();
  const pathname = usePathname();

  // Shows the city of the pinned default address once we know it.
  const [place, setPlace] = useState('Choose location');
  useEffect(() => {
    const sync = () => setPlace(getDeliveryPoint()?.label || 'Choose location');
    sync();
    window.addEventListener(POINT_EVENT, sync);
    return () => window.removeEventListener(POINT_EVENT, sync);
  }, []);

  // Tuck the header away while the page scrolls down (finger or mouse wheel)
  // and bring it back the moment it scrolls up, so the page gets the full
  // screen — the grocery-app behaviour.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) setHidden(false);
        else if (y > last + 6) setHidden(true);
        else if (y < last - 6) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const count = cart?.itemCount ?? 0;
  const total = cart?.total ?? 0;
  const tabs = home?.topTabs ?? [];

  return (
    <header className={s.hdr} data-site-header data-hidden={hidden}>
      <div className={s.brandBar}>
        <div className={`page ${s.row}`}>
          <Link href="/" className={s.logo} aria-label="Bingoor home">
            <img src="/logo-mark.png" alt="" width={38} height={38} className={s.mark} />
            <span className={s.word}>
              Bingoor
              <span className={s.promise}>
                <Icon name="bolt" size={11} strokeWidth={2.4} />
                {home ? `${shortDelivery(home)}${/delivery/i.test(shortDelivery(home)) ? '' : ' delivery'}` : 'Minutes, not days'}
              </span>
            </span>
          </Link>

          <button
            type="button"
            className={s.place}
            onClick={() => window.dispatchEvent(new Event(OPEN_LOCATION_EVENT))}
            aria-label="Change delivery location"
            style={{ background: 'none', borderTop: 0, borderRight: 0, borderBottom: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
          >
            <Icon name="pin" size={17} />
            <span className={s.placeText}>
              <span className={s.placeLabel}>Delivering to</span>
              <span className={s.placeName}>{place}</span>
            </span>
            {/* Tells the customer this is where the address is changed. */}
            <Icon name="chevron-down" size={16} strokeWidth={2.4} />
          </button>

          <div className={s.searchWide}>
            <SearchBar />
          </div>

          <nav className={s.tools} aria-label="Account">
            <button className={s.tool} onClick={() => window.dispatchEvent(new Event(OPEN_LOCATION_EVENT))} aria-label="Change delivery location">
              <Icon name="pin" size={19} />
            </button>
            <NoticeBell />
            <LanguageMenu />
            <button
              className={s.tool}
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>
            <Link
              href="/wishlist"
              className={`${s.tool} ${s.wish}`}
              aria-label={saved > 0 ? `Wishlist, ${saved} item${saved > 1 ? 's' : ''}` : 'Wishlist'}
            >
              <Icon name="heart" size={19} />
              {/* Keyed by count so it pops each time a product is saved. */}
              {saved > 0 ? (
                <span key={saved} className={`num ${s.badge}`} aria-hidden>
                  {saved > 99 ? '99+' : saved}
                </span>
              ) : null}
            </Link>
            <Link href={user ? '/profile' : '/login'} className={s.account}>
              <Icon name="user" size={18} />
              <span className={s.accountText}>{user ? user.name.split(' ')[0] : t('signIn')}</span>
            </Link>
            <Link href="/cart" className={s.cart} data-filled={count > 0} aria-label={count > 0 ? `Cart, ${count} item${count > 1 ? 's' : ''}` : 'Cart'}>
              <Icon name="cart" size={18} />
              {/* Phones only show the icon, so the count rides on it as a badge.
                  Keyed by count so it pops each time something is added. */}
              {count > 0 ? (
                <span key={count} className={`num ${s.badge} ${s.cartBadge}`} aria-hidden>
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
              {count > 0 ? (
                <span className={s.cartText}>
                  <span className={`num ${s.cartCount}`}>
                    {count} item{count > 1 ? 's' : ''}
                  </span>
                  <span className={`num ${s.cartTotal}`}>₹{total}</span>
                </span>
              ) : (
                <span className={s.cartText}>
                  <span className={s.cartTotal}>{t('cart')}</span>
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>

      {/* On phones and small tablets the search bar is always open, no tap needed. */}
      <div className={`${s.brandBar} ${s.searchNarrow}`}>
        <div className="page">
          <SearchBar />
        </div>
      </div>

      {tabs.length > 0 ? (
        <div className={s.strip}>
          <div className={`page rail ${s.stripRow}`}>
            <Link href="/categories" className={s.stripLink} data-on={pathname === '/categories'}>
              <Icon name="grid" size={15} />
              All
            </Link>
            {settings?.festival?.enabled ? (
              <Link href="/festival" className={s.stripLink} data-on={pathname === '/festival'}>
                <Icon name="gift" size={15} />
                {settings.festival?.name || 'Festival'}
              </Link>
            ) : null}
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/categories/${tab.slug}`}
                className={s.stripLink}
                data-on={pathname === `/categories/${tab.slug}`}
              >
                {tab.nameHi && name(tab) !== tab.name ? name(tab) : tab.short || tab.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
