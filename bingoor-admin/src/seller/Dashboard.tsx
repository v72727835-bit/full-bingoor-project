"use client";

import React, { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NavLink } from '../navigation';
import { sellerDashboard, WarehouseDashboard } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { IconAlert, IconBox, IconReceipt, IconRupee } from '../components/icons';
import { Badge, Card, CenterSpinner, ErrorBanner, StatCard, dayLabel, money, timeAgo } from '../components/ui';
import { statusLabel, statusTone } from './common';

export default function Dashboard() {
  const [d, setD] = useState<WarehouseDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => sellerDashboard().then(setD).catch((e) => setError(getErrorMessage(e)));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!d) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;
  const by = d.orders.byStatus;
  const active = (by.accepted ?? 0) + (by.preparing ?? 0) + (by.ready_for_pickup ?? 0) + (by.out_for_delivery ?? 0);
  const chart = d.trend.map((t) => ({ ...t, label: dayLabel(t.date) }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">How your warehouse is doing today.</div>
        </div>
      </div>
      <ErrorBanner message={error} />

      <div className="grid grid-4">
        <StatCard label="Today's orders" value={String(d.today.orders)} icon={<IconReceipt />} spark={d.trend.map((t) => t.orders)} hint={`${d.orders.total} orders in all`} />
        <StatCard label="Today's sales" value={money(d.today.revenue)} icon={<IconRupee />} tone="var(--ok)" toneSoft="var(--ok-soft)" spark={d.trend.map((t) => t.revenue)} hint={`${money(d.deliveredRevenue)} delivered so far`} />
        <StatCard label="Waiting to be accepted" value={String(by.placed ?? 0)} icon={<IconReceipt />} tone="var(--warn)" toneSoft="var(--warn-soft)" hint={`${active} in progress`} />
        <StatCard label="Low / out of stock" value={`${d.lowStock.length} / ${d.outOfStock}`} icon={<IconAlert />} tone="var(--danger)" toneSoft="var(--danger-soft)" hint={`${d.products.live} live · ${d.products.off} off shelf`} />
      </div>

      <div className="grid grid-2">
        <Card title="Sales, last 7 days">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="whg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand)" fill="url(#whg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Order pipeline">
          {(['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'] as const).map((s) => (
            <div key={s} className="row-flex" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
              <Badge tone={statusTone(s)}>{statusLabel(s)}</Badge>
              <b>{by[s] ?? 0}</b>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Best sellers" icon={<IconBox />}>
          {d.topProducts.length === 0 ? (
            <div className="empty-state">No sales yet.</div>
          ) : (
            d.topProducts.map((p) => (
              <div key={p._id} className="row-flex" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{p.name}</span>
                <span className="cell-muted">{p.qty} sold · {money(p.revenue)}</span>
              </div>
            ))
          )}
        </Card>
        <Card title="Running low" icon={<IconAlert />} action={<NavLink to="/inventory" className="btn btn-sm btn-secondary">Manage stock</NavLink>}>
          {d.lowStock.length === 0 ? (
            <div className="empty-state">Everything is well stocked.</div>
          ) : (
            d.lowStock.map((p) => (
              <div key={p._id} className="row-flex" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{p.name} <span className="cell-muted">{p.unit}</span></span>
                <Badge tone="warn">{p.stock} left</Badge>
              </div>
            ))
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Recent orders" action={<NavLink to="/orders" className="btn btn-sm btn-secondary">All orders</NavLink>}>
          {d.recent.length === 0 ? (
            <div className="empty-state">No orders yet.</div>
          ) : (
            d.recent.map((o) => (
              <div key={o._id} className="row-flex" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>#{o.orderNumber} <span className="cell-muted">{timeAgo(o.createdAt)} · {o.paymentMethod === 'cod' ? 'COD' : 'Paid online'}</span></span>
                <span>
                  {money(o.total)} <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
