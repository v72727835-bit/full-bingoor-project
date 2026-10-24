import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from '../navigation';
import { fetchAdminAlerts, fetchOrders, fetchWarehouseApplications, fetchProducts, fetchShops, fetchTickets, markAdminAlertsRead } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { askNotificationPermission, notifyNewOrders, playChime } from '../lib/alerts';
import { activeOrderCount, useStats } from '../context/StatsContext';
import {
  IconAlert,
  IconBell,
  IconBolt,
  IconBox,
  IconChart,
  IconDashboard,
  IconImage,
  IconVideo,
  IconLayers,
  IconReceipt,
  IconRefresh,
  IconRider,
  IconSearch,
  IconSettings,
  IconVolume,
  IconShield,
  IconStore,
  IconTag,
  IconUsers,
} from './icons';
import { Modal, timeAgo } from './ui';
import type { AdminAlert } from '../types';

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: number;
  badgeTone?: 'brand' | 'warn';
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { stats, refresh, lastUpdated, loading } = useStats();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const live = activeOrderCount(stats);
  const lowStock = stats?.products.lowStock ?? 0;
  const riders = stats?.usersByRole?.rider?.active ?? 0;

  /* New-order alert on every page: poll the count of orders waiting to be
     accepted; when it goes up, chime, raise a desktop notification and put
     the count in the tab title. Live Orders has its own chime, so skip there. */
  const waiting = useRef<number | null>(null);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    askNotificationPermission();
    let alive = true;
    const check = () =>
      fetchOrders({ page: 1, limit: 1, status: 'placed' })
        .then(({ meta }) => {
          if (!alive) return;
          const total = meta?.total ?? 0;
          if (waiting.current !== null && total > waiting.current && !window.location.pathname.startsWith('/orders')) {
            playChime();
            notifyNewOrders(total - waiting.current, () => navigate('/orders?live=1'));
          }
          waiting.current = total;
          setPending(total);
        })
        .catch(() => undefined);
    check();
    const timer = setInterval(check, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [navigate]);
  useEffect(() => {
    document.title = pending > 0 ? `(${pending}) New orders · Bingoor Admin` : 'Bingoor Admin';
  }, [pending]);

  /* Unanswered customer-care chats, and the dashboard bell's own alerts
     (a rider paused for unsubmitted cash). Both poll on the same timer. */
  const [careUnread, setCareUnread] = useState(0);
  const [paused, setPaused] = useState<AdminAlert[]>([]);
  const [whPending, setWhPending] = useState(0);
  useEffect(() => {
    let alive = true;
    const check = () => {
      fetchTickets({ page: 1, limit: 1, status: 'open' })
        .then(({ meta }) => alive && setCareUnread(meta?.unread ?? 0))
        .catch(() => undefined);
      fetchWarehouseApplications({ status: 'pending', page: 1, limit: 1 })
        .then(({ pending }) => alive && setWhPending(pending))
        .catch(() => undefined);
      fetchAdminAlerts()
        .then(({ items }) => alive && setPaused(items.filter((a) => !a.read)))
        .catch(() => undefined);
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Overview',
      items: [
        { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
        { to: '/orders?live=1', label: 'Live Orders', icon: <IconBolt />, badge: live, badgeTone: 'brand' },
        { to: '/analytics', label: 'Analytics', icon: <IconChart /> },
      ],
    },
    {
      title: 'Catalogue',
      items: [
        { to: '/products', label: 'Products', icon: <IconBox /> },
        { to: '/inventory', label: 'Inventory', icon: <IconAlert />, badge: lowStock, badgeTone: 'warn' },
        { to: '/categories', label: 'Categories', icon: <IconLayers /> },
        { to: '/standard-categories', label: 'Standard category', icon: <IconLayers /> },
        { to: '/banners', label: 'Home Banners', icon: <IconImage /> },
        { to: '/gallery', label: 'Gallery', icon: <IconImage /> },
        { to: '/videos', label: 'Videos', icon: <IconVideo /> },
        { to: '/store-settings', label: 'Store Settings', icon: <IconSettings /> },
        { to: '/integrations', label: 'Login & Payments', icon: <IconShield /> },
        { to: '/delivery-pricing', label: 'Delivery & Pricing', icon: <IconTag /> },
        { to: '/offers', label: 'Offers & Coupons', icon: <IconTag /> },
      ],
    },
    {
      title: 'Operations',
      items: [

        { to: '/shops', label: 'Warehouses', icon: <IconStore /> },
        { to: '/warehouse-requests', label: 'Warehouse requests', icon: <IconStore />, badge: whPending, badgeTone: 'warn' },
        { to: '/riders', label: 'Riders', icon: <IconRider />, badge: riders, badgeTone: 'brand' },
        { to: '/payouts', label: 'Rider Payouts', icon: <IconTag /> },
        { to: '/support', label: 'Customer Care', icon: <IconBell />, badge: careUnread, badgeTone: 'brand' },
        { to: '/notifications', label: 'Notifications', icon: <IconVolume /> },
        { to: '/customers', label: 'Customers', icon: <IconUsers /> },
        { to: '/enquiries', label: 'Enquiries', icon: <IconBell /> },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/team', label: 'Team & Access', icon: <IconShield /> },
        { to: '/settings', label: 'Settings', icon: <IconSettings /> },
      ],
    },
  ];

  const alerts = useMemo(() => {
    const out: { text: string; tone: string; to: string }[] = [];
    if (live > 0) out.push({ text: `${live} order${live > 1 ? 's' : ''} waiting to be moved along`, tone: 'brand', to: '/orders?live=1' });
    if (lowStock > 0) out.push({ text: `${lowStock} product${lowStock > 1 ? 's are' : ' is'} low on stock`, tone: 'warn', to: '/inventory' });
    if (stats && riders === 0) out.push({ text: 'No active riders right now', tone: 'warn', to: '/riders' });
    if ((stats?.orders.byStatus.placed ?? 0) > 0)
      out.push({ text: `${stats?.orders.byStatus.placed} new order(s) not accepted yet`, tone: 'brand', to: '/orders?live=1' });
    // Riders paused automatically for unsubmitted cash.
    paused.forEach((a) => out.push({ text: a.message, tone: 'warn', to: a.type === 'warehouse_registered' ? '/warehouse-requests' : '/riders' }));
    if (careUnread > 0)
      out.push({ text: `${careUnread} customer care chat${careUnread > 1 ? 's' : ''} waiting for a reply`, tone: 'brand', to: '/support' });
    return out;
  }, [live, lowStock, riders, stats, paused, careUnread]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img className="logo-mark" src="/logo-mark.png" alt="Bingoor" width={36} height={36} />
          <div className="logo-text">
            <b>Bingoor</b>
            <span>Super Admin</span>
          </div>
        </div>

        <div className="sidebar-scroll">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="nav-section">{g.title}</div>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {!!item.badge && <span className={`nav-badge${item.badgeTone === 'warn' ? ' warn' : ''}`}>{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="health-card">
            <div className="hc-title">
              <span className="pulse-dot" style={{ color: 'var(--ok)' }} />
              System healthy
            </div>
            <div className="hc-sub">
              {stats ? `${stats.products.active} live products · ${stats.shops} warehouses` : 'Connecting to the API…'}
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <IconSearch size={17} />
            Search orders, products, warehouses or jump to a page…
            <span className="kbd">Ctrl K</span>
          </button>

          <div className="top-actions">
            <button className="icon-btn" title="Refresh data" onClick={refresh} disabled={loading}>
              <IconRefresh size={17} />
            </button>
            <button
              className="icon-btn"
              title="Alerts"
              onClick={() => {
                setBellOpen(true);
                if (paused.length) markAdminAlertsRead().catch(() => undefined);
              }}
            >
              <IconBell size={17} />
              {alerts.length > 0 && <span className="dot-badge">{alerts.length}</span>}
            </button>
            <div className="user-chip">
              <div className="avatar">{(user?.name ?? 'A').slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="u-name">{user?.name ?? 'Admin'}</div>
                <div className="u-role">Super Admin</div>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          {children}
        </div>
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      {bellOpen && (
        <Modal title="Alerts" onClose={() => setBellOpen(false)}>
          {alerts.length === 0 ? (
            <div className="empty-state">There are no alerts at the moment.</div>
          ) : (
            alerts.map((a, i) => (
              <button
                key={i}
                className="qa-btn"
                style={{ width: '100%', marginBottom: 8 }}
                onClick={() => {
                  setBellOpen(false);
                  navigate(a.to);
                }}
              >
                <span className="qa-icon" style={a.tone === 'warn' ? { background: 'var(--warn-soft)', color: 'var(--warn)' } : undefined}>
                  <IconAlert size={16} />
                </span>
                {a.text}
              </button>
            ))
          )}
          {lastUpdated && (
            <div className="cell-muted" style={{ marginTop: 12, textAlign: 'center' }}>
              Updated {timeAgo(lastUpdated.toISOString())}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------- command palette (Ctrl/Cmd + K) ---------------- */

const PAGES: { label: string; to: string }[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Live Orders', to: '/orders?live=1' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Products', to: '/products' },
  { label: 'Add a product', to: '/products?new=1' },
  { label: 'Inventory / low stock', to: '/inventory' },
  { label: 'Categories', to: '/categories' },
  { label: 'Standard category (home rows)', to: '/standard-categories' },
  { label: 'Store Settings (festival, 6-day delivery, COD)', to: '/store-settings' },
  { label: 'Login & Payments (Google, Facebook, Razorpay keys)', to: '/integrations' },
  { label: 'Chat with customer care', to: '/support' },
  { label: 'Notifications & back-in-stock', to: '/notifications' },
  { label: 'Rider accounts', to: '/rider-accounts' },
  { label: 'Home Banners', to: '/banners' },
  { label: 'Gallery (photos)', to: '/gallery' },
  { label: 'Videos', to: '/videos' },
  { label: 'Offers & Coupons', to: '/offers' },

  { label: 'Warehouses', to: '/shops' },
  { label: 'Riders', to: '/riders' },
  { label: 'Customers', to: '/customers' },
  { label: 'Team & Access', to: '/team' },
  { label: 'Settings', to: '/settings' },
];

type Hit = { label: string; sub?: string; to: string };

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ products: Hit[]; orders: Hit[]; shops: Hit[] }>({ products: [], orders: [], shops: [] });
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).slice(0, 6);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits({ products: [], orders: [], shops: [] });
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      Promise.allSettled([
        fetchProducts({ page: 1, limit: 5, q: term }),
        fetchOrders({ page: 1, limit: 5, q: term }),
        fetchShops({ page: 1, limit: 20 }),
      ])
        .then(([p, o, s]) => {
          setHits({
            products:
              p.status === 'fulfilled'
                ? p.value.items.map((x) => ({ label: x.name, sub: `₹${x.price}`, to: '/products' }))
                : [],
            orders:
              o.status === 'fulfilled'
                ? o.value.items.map((x) => ({ label: `#${x.orderNumber}`, sub: x.status, to: `/orders?id=${x._id}` }))
                : [],
            shops:
              s.status === 'fulfilled'
                ? s.value.items
                    .filter((x) => x.name.toLowerCase().includes(term.toLowerCase()))
                    .slice(0, 5)
                    .map((x) => ({ label: x.name, sub: x.address?.city, to: '/shops' }))
                : [],
          });
        })
        .finally(() => setSearching(false));
    }, 260);
    return () => clearTimeout(t);
  }, [q]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette">
        <input
          className="palette-input"
          autoFocus
          placeholder="Search products, orders, warehouses…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') {
              const first = hits.products[0] ?? hits.orders[0] ?? hits.shops[0] ?? pages[0];
              if (first) go(first.to);
            }
          }}
        />
        <div className="palette-list">
          {pages.length > 0 && (
            <>
              <div className="palette-group">Go to</div>
              {pages.map((p) => (
                <button key={p.to} className="palette-item" onClick={() => go(p.to)}>
                  <IconDashboard size={15} />
                  {p.label}
                </button>
              ))}
            </>
          )}
          <PaletteGroup title="Products" icon={<IconBox size={15} />} items={hits.products} onPick={go} />
          <PaletteGroup title="Orders" icon={<IconReceipt size={15} />} items={hits.orders} onPick={go} />
          <PaletteGroup title="Warehouses" icon={<IconStore size={15} />} items={hits.shops} onPick={go} />
          {searching && <div className="palette-group">Searching…</div>}
          {!searching && q.trim().length >= 2 && !hits.products.length && !hits.orders.length && !hits.shops.length && (
            <div className="empty-state" style={{ padding: 24 }}>
              Nothing matched “{q}”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaletteGroup({
  title,
  icon,
  items,
  onPick,
}: {
  title: string;
  icon: React.ReactNode;
  items: Hit[];
  onPick: (to: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="palette-group">{title}</div>
      {items.map((h, i) => (
        <button key={`${h.label}-${i}`} className="palette-item" onClick={() => onPick(h.to)}>
          {icon}
          {h.label}
          {h.sub && <span className="pi-sub">{h.sub}</span>}
        </button>
      ))}
    </>
  );
}
