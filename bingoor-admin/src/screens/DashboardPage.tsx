import React from 'react';
import { useNavigate } from '../navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import {
  IconAlert,
  IconBolt,
  IconBox,
  IconCheck,
  IconLayers,
  IconPlus,
  IconReceipt,
  IconRider,
  IconRupee,
  IconStore,
  IconTag,
  IconTruck,
  IconUsers,
} from '../components/icons';
import {
  Badge,
  Card,
  CenterSpinner,
  Delta,
  ErrorBanner,
  StatCard,
  Tabs,
  Thumb,
  dayLabel,
  money,
  moneyShort,
  timeAgo,
} from '../components/ui';
import { activeOrderCount, useStats } from '../context/StatsContext';
import { Order, OrderStatus } from '../types';
import { STATUS_COLOR, statusLabel, statusTone } from './OrdersPage';

export default function DashboardPage() {
  const { stats, error, days, setDays, lastUpdated } = useStats();
  const navigate = useNavigate();

  if (error && !stats) return <ErrorBanner message={error} />;
  if (!stats) return <CenterSpinner />;

  const live = activeOrderCount(stats);
  const trend = stats.trend ?? [];
  const chartData = trend.map((t) => ({ ...t, label: dayLabel(t.date) }));
  const pipeline = Object.entries(stats.orders.byStatus)
    .map(([status, count]) => ({ status: status as OrderStatus, count }))
    .sort((a, b) => b.count - a.count);
  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0) || 1;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}</h1>
          <div className="page-subtitle">
            An overview of activity across Bingoor today
            {lastUpdated && ` · updated ${timeAgo(lastUpdated.toISOString())}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="live-pill">
            <span className="pulse-dot" />
            Live operations
          </span>
          <Tabs
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
        </div>
      </div>

      {/* ---------- KPI row ---------- */}
      <div className="grid grid-4">
        <StatCard
          label="Today's revenue"
          value={moneyShort(stats.today.revenue)}
          icon={<IconRupee size={19} />}
          tone="var(--brand)"
          toneSoft="var(--brand-soft)"
          delta={<Delta current={stats.today.revenue} previous={stats.yesterday.revenue} suffix="vs yesterday" />}
          spark={trend.map((t) => t.revenue)}
        />
        <StatCard
          label="Orders today"
          value={String(stats.today.orders)}
          icon={<IconReceipt size={19} />}
          tone="var(--info)"
          toneSoft="var(--info-soft)"
          delta={<Delta current={stats.today.orders} previous={stats.yesterday.orders} suffix="vs yesterday" />}
          spark={trend.map((t) => t.orders)}
        />
        <StatCard
          label="Live orders"
          value={String(live)}
          icon={<IconTruck size={19} />}
          tone="var(--ok)"
          toneSoft="var(--ok-soft)"
          hint={`${stats.orders.byStatus.placed ?? 0} waiting to be accepted`}
        />
        <StatCard
          label="Lifetime revenue"
          value={moneyShort(stats.revenue)}
          icon={<IconCheck size={19} />}
          tone="var(--brand-2)"
          toneSoft="var(--brand-soft)"
          hint={`${stats.orders.total} orders all-time`}
        />
      </div>

      {/* ---------- pulse + pipeline + quick actions ---------- */}
      <div className="grid grid-3-lean">
        <Card
          title="Order volume"
          icon={<IconBolt size={16} />}
          action={<span className="cell-muted">last {days} days</span>}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2fbf6a" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#2fbf6a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#97a1b8' }} iconType="circle" iconSize={8} />
                <Area
                  type="monotone"
                  name="Orders"
                  dataKey="orders"
                  stroke="#2fbf6a"
                  strokeWidth={2.4}
                  fill="url(#gOrders)"
                  dot={false}
                />
                <Line type="monotone" name="Delivered" dataKey="delivered" stroke="#2ed47a" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  name="Cancelled"
                  dataKey="cancelled"
                  stroke="#ff5470"
                  strokeWidth={1.6}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Dispatch status" icon={<IconTruck size={16} />}>
          <div style={{ height: 150, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pipeline}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={46}
                  outerRadius={66}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {pipeline.map((p) => (
                    <Cell key={p.status} fill={STATUS_COLOR[p.status] ?? '#8a94ac'} />
                  ))}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeContent: 'center',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>{stats.orders.total}</div>
              <div className="cell-muted" style={{ fontSize: 11 }}>
                total orders
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {pipeline.slice(0, 6).map((p) => (
              <div key={p.status} className="meter-row">
                <span className="meter-dot" style={{ background: STATUS_COLOR[p.status] ?? '#8a94ac' }} />
                <span className="meter-name">{statusLabel(p.status)}</span>
                <span className="meter-track">
                  <span
                    className="meter-fill"
                    style={{ width: `${(p.count / pipelineTotal) * 100}%`, background: STATUS_COLOR[p.status] ?? '#8a94ac' }}
                  />
                </span>
                <span className="meter-val">{p.count}</span>
                <span className="meter-pct">{((p.count / pipelineTotal) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick actions" icon={<IconPlus size={16} />}>
          <div className="qa-grid">
            <QA icon={<IconPlus size={15} />} label="Add product" onClick={() => navigate('/products?new=1')} />
            <QA icon={<IconAlert size={15} />} label="Low stock" onClick={() => navigate('/inventory')} />
            <QA icon={<IconBolt size={15} />} label="Live orders" onClick={() => navigate('/orders?live=1')} />
            <QA icon={<IconTag size={15} />} label="New coupon" onClick={() => navigate('/offers?new=1')} />
            <QA icon={<IconLayers size={15} />} label="Categories" onClick={() => navigate('/categories')} />
            <QA icon={<IconStore size={15} />} label="Add shop" onClick={() => navigate('/shops?new=1')} />
            <QA icon={<IconRider size={15} />} label="Riders" onClick={() => navigate('/riders')} />
            <QA icon={<IconBox size={15} />} label="Analytics" onClick={() => navigate('/analytics')} />
          </div>

          <div className="health-card" style={{ marginTop: 14 }}>
            <div className="hc-title">
              <IconBolt size={14} />
              Catalogue summary
            </div>
            <div className="hc-sub">
              {stats.products.active} active products across {stats.categories} categories · {stats.shops} shops ·{' '}
              {stats.customers} customers
            </div>
          </div>
        </Card>
      </div>

      {/* ---------- live orders + top products + low stock ---------- */}
      <div className="grid grid-3-lean">
        <Card
          title="Recent orders"
          icon={<IconReceipt size={16} />}
          pad={false}
          action={
            <button className="card-link" onClick={() => navigate('/orders')}>
              View all →
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((o: Order) => {
                  const u = typeof o.user === 'string' ? null : o.user;
                  return (
                    <tr key={o._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders?id=${o._id}`)}>
                      <td>
                        <div className="cell-name">#{o.orderNumber}</div>
                        <div className="cell-muted">{timeAgo(o.createdAt)}</div>
                      </td>
                      <td>
                        {u?.name ?? '—'}
                        <div className="cell-muted">{u?.phone}</div>
                      </td>
                      <td>
                        <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                      </td>
                      <td className="cell-name">{money(o.total)}</td>
                    </tr>
                  );
                })}
                {stats.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Best sellers" icon={<IconBox size={16} />} pad={false}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th>Product</th>
                  <th>Sold</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((p, i) => (
                  <tr key={p._id}>
                    <td>
                      <span className="rank-num">{i + 1}</span>
                    </td>
                    <td>
                      <div className="row-flex">
                        <Thumb src={p.images?.[0]} />
                        <div>
                          <div className="cell-name">{p.name}</div>
                          <div className="cell-muted">
                            {p.unit} · {money(p.price)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="cell-name">{p.soldCount}</td>
                  </tr>
                ))}
                {stats.topProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      No sales recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Low stock alerts"
          icon={<IconAlert size={16} />}
          pad={false}
          action={
            <button className="card-link" onClick={() => navigate('/inventory')}>
              Manage →
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Left</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockList.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="cell-name">{p.name}</div>
                      <div className="cell-muted">{typeof p.shop === 'string' ? '' : p.shop?.name}</div>
                    </td>
                    <td className="cell-name">{p.stock}</td>
                    <td>
                      <Badge tone={p.stock === 0 ? 'danger' : p.stock <= 2 ? 'danger' : 'warn'}>
                        {p.stock === 0 ? 'Out' : p.stock <= 2 ? 'Critical' : 'Low'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {stats.lowStockList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      Everything is well stocked 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ---------- customers + activity ---------- */}
      <div className="grid grid-2">
        <Card
          title="Newest customers"
          icon={<IconUsers size={16} />}
          pad={false}
          action={
            <button className="card-link" onClick={() => navigate('/customers')}>
              View all →
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Joined</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCustomers.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="row-flex">
                        <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="cell-name">{c.name}</span>
                      </div>
                    </td>
                    <td className="cell-muted">{c.phone}</td>
                    <td className="cell-muted">{timeAgo(c.createdAt)}</td>
                    <td className="cell-muted">{c.lastLoginAt ? timeAgo(c.lastLoginAt) : '—'}</td>
                  </tr>
                ))}
                {stats.recentCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No customers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Recent activity" icon={<IconBolt size={16} />}>
          {stats.recentOrders.length === 0 ? (
            <div className="empty-state">Nothing has happened yet today.</div>
          ) : (
            stats.recentOrders.slice(0, 6).map((o) => {
              const u = typeof o.user === 'string' ? null : o.user;
              const sh = typeof o.shop === 'string' ? null : o.shop;
              const tone = statusTone(o.status);
              return (
                <div className="feed-item" key={o._id}>
                  <span
                    className="feed-icon"
                    style={{
                      background: `var(--${tone === 'muted' ? 'panel-2' : tone === 'brand' ? 'brand' : tone}-soft, rgba(255,255,255,.06))`,
                      color: STATUS_COLOR[o.status] ?? 'var(--ink-soft)',
                    }}
                  >
                    <IconReceipt size={15} />
                  </span>
                  <div className="feed-text">
                    <b>{statusLabel(o.status)}</b> — order #{o.orderNumber} from {u?.name ?? 'a customer'}
                    {sh ? ` at ${sh.name}` : ''} · {money(o.total)}
                  </div>
                  <span className="feed-time">{timeAgo(o.createdAt)}</span>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}

function QA({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="qa-btn" onClick={onClick}>
      <span className="qa-icon">{icon}</span>
      {label}
    </button>
  );
}

/* ---------- chart tooltips ---------- */

interface TipPayload {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { status?: string; count?: number };
}

export function ChartTip({ active, payload, label }: { active?: boolean; payload?: TipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        padding: '9px 12px',
        fontSize: 12.5,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <b>{typeof p.value === 'number' && p.name === 'Revenue' ? money(p.value) : p.value}</b>
        </div>
      ))}
    </div>
  );
}

function PieTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item?.status) return null;
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        padding: '8px 11px',
        fontSize: 12.5,
      }}
    >
      {statusLabel(item.status as OrderStatus)} — <b>{item.count}</b>
    </div>
  );
}
