import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchCategories, fetchProducts, fetchAllShops } from '../api/admin';
import { IconBox, IconChart, IconReceipt, IconRupee, IconStore } from '../components/icons';
import {
  Card,
  CenterSpinner,
  Delta,
  ErrorBanner,
  StatCard,
  Tabs,
  dayLabel,
  money,
  moneyShort,
} from '../components/ui';
import { useStats } from '../context/StatsContext';
import { Category, Product, Shop } from '../types';
import { ChartTip } from './DashboardPage';
import { STATUS_COLOR, statusLabel } from './OrdersPage';

export default function AnalyticsPage() {
  const { stats, error, days, setDays } = useStats();
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);

  useEffect(() => {
    Promise.allSettled([
      fetchAllShops(),
      fetchCategories(),
      fetchProducts({ page: 1, limit: 50 }),
    ]).then(([s, c, p]) => {
      if (s.status === 'fulfilled') setShops(s.value);
      if (c.status === 'fulfilled') setCategories(c.value);
      if (p.status === 'fulfilled') setRecent(p.value.items);
    });
  }, []);

  if (error && !stats) return <ErrorBanner message={error} />;
  if (!stats) return <CenterSpinner />;

  const trend = stats.trend.map((t) => ({ ...t, label: dayLabel(t.date) }));
  const windowOrders = stats.trend.reduce((s, t) => s + t.orders, 0);
  const windowRevenue = stats.trend.reduce((s, t) => s + t.revenue, 0);
  const half = Math.floor(stats.trend.length / 2);
  const firstHalf = stats.trend.slice(0, half).reduce((s, t) => s + t.revenue, 0);
  const secondHalf = stats.trend.slice(half).reduce((s, t) => s + t.revenue, 0);
  const aov = windowOrders ? windowRevenue / windowOrders : 0;
  const delivered = stats.trend.reduce((s, t) => s + t.delivered, 0);
  const cancelled = stats.trend.reduce((s, t) => s + t.cancelled, 0);
  const fulfilment = windowOrders ? (delivered / windowOrders) * 100 : 0;

  const statusBars = Object.entries(stats.orders.byStatus)
    .map(([status, count]) => ({ status, label: statusLabel(status as never), count }))
    .sort((a, b) => b.count - a.count);

  // products per category (level-3), so you can see where the catalogue is thin
  const catNameById = new Map(categories.map((c) => [c._id, c.name]));
  const perCategory = new Map<string, number>();
  for (const p of recent) {
    const id = typeof p.category === 'string' ? p.category : p.category?._id;
    const name = (id && catNameById.get(id)) || (typeof p.category === 'string' ? 'Unknown' : p.category?.name) || 'Unknown';
    perCategory.set(name, (perCategory.get(name) ?? 0) + 1);
  }
  const catBars = [...perCategory.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="page-subtitle">How Bingoor performed over the last {days} days.</div>
        </div>
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

      <div className="grid grid-4">
        <StatCard
          label={`Revenue (${days}d)`}
          value={moneyShort(windowRevenue)}
          icon={<IconRupee size={19} />}
          tone="var(--brand)"
          toneSoft="var(--brand-soft)"
          delta={<Delta current={secondHalf} previous={firstHalf} suffix="vs earlier half" />}
          spark={stats.trend.map((t) => t.revenue)}
        />
        <StatCard
          label={`Orders (${days}d)`}
          value={String(windowOrders)}
          icon={<IconReceipt size={19} />}
          tone="var(--info)"
          toneSoft="var(--info-soft)"
          hint={`${delivered} delivered · ${cancelled} cancelled`}
          spark={stats.trend.map((t) => t.orders)}
        />
        <StatCard
          label="Average order value"
          value={money(aov)}
          icon={<IconChart size={19} />}
          tone="var(--brand-2)"
          toneSoft="var(--brand-soft)"
          hint="Revenue ÷ orders in this window"
        />
        <StatCard
          label="Fulfilment rate"
          value={`${fulfilment.toFixed(1)}%`}
          icon={<IconStore size={19} />}
          tone="var(--ok)"
          toneSoft="var(--ok-soft)"
          hint={`${cancelled} orders lost`}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <Card title="Revenue vs orders" icon={<IconChart size={16} />}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis yAxisId="l" tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Bar yAxisId="l" name="Revenue" dataKey="revenue" fill="#2fbf6a" radius={[6, 6, 0, 0]} maxBarSize={34} />
                <Line yAxisId="r" name="Orders" type="monotone" dataKey="orders" stroke="#3bc9f5" strokeWidth={2.4} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Orders by status" icon={<IconReceipt size={16} />}>
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBars} layout="vertical" margin={{ top: 4, right: 16, left: 34, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: '#97a1b8', fontSize: 11.5 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar name="Orders" dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {statusBars.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? '#8a94ac'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Catalogue spread" icon={<IconBox size={16} />} action={<span className="cell-muted">latest 100 products</span>}>
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catBars} margin={{ top: 4, right: 10, left: -18, bottom: 40 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#667089', fontSize: 10.5 }}
                  tickLine={false}
                  axisLine={false}
                  angle={-32}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis tick={{ fill: '#667089', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar name="Products" dataKey="count" fill="#ffc93c" radius={[6, 6, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Best sellers" icon={<IconBox size={16} />} pad={false}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Units sold</th>
                  <th>Est. revenue</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((p, i) => (
                  <tr key={p._id}>
                    <td>
                      <span className="rank-num">{i + 1}</span>
                    </td>
                    <td className="cell-name">{p.name}</td>
                    <td>{p.soldCount}</td>
                    <td>{money(p.soldCount * p.price)}</td>
                    <td className={p.stock <= 5 ? 'cell-name' : 'cell-muted'}>{p.stock}</td>
                  </tr>
                ))}
                {stats.topProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Network" icon={<IconStore size={16} />} pad={false}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>City</th>
                  <th>Delivery fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shops.slice(0, 8).map((s) => (
                  <tr key={s._id}>
                    <td className="cell-name">{s.name}</td>
                    <td className="cell-muted">{s.address?.city || '—'}</td>
                    <td>{money(s.deliveryFee)}</td>
                    <td className="cell-muted">{s.isOpen ? 'Open' : 'Closed'}</td>
                  </tr>
                ))}
                {shops.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No shops yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
