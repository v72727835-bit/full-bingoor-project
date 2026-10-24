"use client";

import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink } from '../navigation';
import { sellerMe, sellerOrders, sellerProducts } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconAlert, IconBell, IconBox, IconDashboard, IconLayers, IconReceipt, IconRider, IconShield, IconStore, IconUsers } from '../components/icons';
import { CenterSpinner, ErrorBanner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { askNotificationPermission, notifyNewOrders, playChime } from '../lib/alerts';
import { SellerProfile } from '../types';
import { CategoriesView, CustomersView, RidersView } from './Views';
import Earnings from './Earnings';
import Dashboard from './Dashboard';
import Inventory from './Inventory';
import Orders from './Orders';
import Products from './Products';
import { AccountView, StoreView } from './Settings';

export type Wh = { _id: string; name: string };
export type Me = { user: { name: string; phone: string; email?: string; sellerId?: string; sellerProfile?: SellerProfile; sellerWarehouses?: Wh[] }; stats: unknown };

/**
 * A warehouse's own panel, laid out like the super admin: a sidebar with the
 * dashboard, orders, products, inventory, categories, riders, customers and
 * the store's own settings. It only ever shows this warehouse's data.
 */
export default function SellerApp() {
  const { logout } = useAuth();
  const pathname = usePathname() ?? '/';
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [newOrders, setNewOrders] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    sellerMe().then((m) => setMe(m as Me)).catch((e) => setError(getErrorMessage(e)));
    askNotificationPermission();
  }, []);

  /* New orders chime on every page; the sidebar badges stay current. */
  const poll = useCallback(() => {
    sellerOrders({ page: 1, limit: 1, status: 'placed' })
      .then(({ meta }) => {
        const total = meta?.total ?? 0;
        if (seen.current !== null && total > seen.current) {
          playChime();
          notifyNewOrders(total - seen.current, () => { window.location.href = '/orders'; });
        }
        seen.current = total;
        setNewOrders(total);
      })
      .catch(() => undefined);
    sellerProducts({ page: 1, limit: 1, status: 'low' })
      .then(({ meta }) => setLowStock(meta?.total ?? 0))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    poll();
    const t = setInterval(poll, 15_000);
    return () => clearInterval(t);
  }, [poll]);
  useEffect(() => {
    document.title = newOrders > 0 ? `(${newOrders}) New orders · Bingoor Warehouse` : 'Bingoor Warehouse';
  }, [newOrders]);

  if (!me) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;
  const warehouses = me.user.sellerWarehouses ?? [];

  const groups: { title: string; items: { to: string; label: string; icon: React.ReactNode; end?: boolean; badge?: number; warn?: boolean }[] }[] = [
    {
      title: 'Overview',
      items: [
        { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
        { to: '/orders', label: 'Orders', icon: <IconReceipt />, badge: newOrders },
      ],
    },
    {
      title: 'Catalogue',
      items: [
        { to: '/products', label: 'Products', icon: <IconBox /> },
        { to: '/inventory', label: 'Inventory', icon: <IconAlert />, badge: lowStock, warn: true },
        { to: '/categories', label: 'Categories', icon: <IconLayers /> },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/riders', label: 'Riders', icon: <IconRider /> },
        { to: '/customers', label: 'Customers', icon: <IconUsers /> },
        { to: '/earnings', label: 'Earnings', icon: <IconReceipt /> },
      ],
    },
    {
      title: 'Warehouse',
      items: [
        { to: '/store', label: 'Store settings', icon: <IconStore /> },
        { to: '/account', label: 'My account', icon: <IconShield /> },
      ],
    },
  ];
  const flat = groups.flatMap((g) => g.items);

  let page: React.ReactNode;
  switch (pathname) {
    case '/':
      page = <Dashboard />;
      break;
    case '/orders':
      page = <Orders onChanged={poll} />;
      break;
    case '/products':
      page = <Products warehouses={warehouses} />;
      break;
    case '/inventory':
      page = <Inventory />;
      break;
    case '/categories':
      page = <CategoriesView />;
      break;
    case '/riders':
      page = <RidersView warehouses={warehouses} />;
      break;
    case '/customers':
      page = <CustomersView />;
      break;
    case '/earnings':
      page = <Earnings />;
      break;
    case '/store':
      page = <StoreView />;
      break;
    case '/account':
      page = <AccountView me={me} onLogout={logout} />;
      break;
    default:
      return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img className="logo-mark" src="/logo-mark.png" alt="Bingoor" width={36} height={36} />
          <div className="logo-text">
            <b>Bingoor</b>
            <span>Warehouse Panel</span>
          </div>
        </div>
        <div className="sidebar-scroll">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="nav-section">{g.title}</div>
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {!!item.badge && <span className={`nav-badge${item.warn ? ' warn' : ''}`}>{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="health-card">
            <div className="hc-title">
              <span className="pulse-dot" style={{ color: 'var(--ok)' }} />
              {warehouses.map((w) => w.name).join(', ') || 'Warehouse'}
            </div>
            <div className="hc-sub">{me.user.name} · {me.user.phone}</div>
          </div>
          <button className="logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="wh-mobile-nav" role="navigation" aria-label="Warehouse menu">
            {flat.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `wh-chip${isActive ? ' active' : ''}`}>
                {item.label}
                {!!item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
          <div className="top-actions">
            <NavLink to="/orders" className="icon-btn">
              <IconBell size={17} />
              {newOrders > 0 && <span className="dot-badge">{newOrders}</span>}
            </NavLink>
            <div className="user-chip">
              <div className="avatar">{me.user.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="u-name">{me.user.name}</div>
                <div className="u-role">Warehouse</div>
              </div>
            </div>
          </div>
        </header>
        <div className="content">{page}</div>
      </main>
    </div>
  );
}
