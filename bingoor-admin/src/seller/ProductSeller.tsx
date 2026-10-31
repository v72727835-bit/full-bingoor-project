"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';
import { sellerMe } from '../api/admin';
import { IconBox, IconReceipt, IconRupee } from '../components/icons';
import { Badge, CenterSpinner, ErrorBanner, Pagination, StatCard, formatDate, money } from '../components/ui';
import { SellerStats } from '../types';

/*
 * #45: what a product seller sees. Only their own sales - product name,
 * quantity and payment. The customer's name, phone and address never reach
 * this panel (the server leaves them out).
 */

export type SellerOrderRow = {
  _id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  amount: number;
  items: { name: string; unit?: string; quantity: number; price: number; lineTotal: number }[];
};

const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger' | 'info' | 'brand' | 'muted'> = {
  placed: 'brand',
  accepted: 'info',
  preparing: 'info',
  ready_for_pickup: 'info',
  out_for_delivery: 'warn',
  delivered: 'success',
  cancelled: 'danger',
  rejected: 'danger',
};

const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const payLabel = (o: Pick<SellerOrderRow, 'paymentMethod' | 'paymentStatus'>) =>
  `${o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'} · ${o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Not paid yet'}`;

async function fetchMyOrders(page: number, status?: string) {
  const { data } = await api.get('/seller/orders', { params: { page, limit: 20, status: status || undefined } });
  return { items: data.data as SellerOrderRow[], totalPages: (data.meta?.totalPages as number) ?? 1 };
}

export function ProductSellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [recent, setRecent] = useState<SellerOrderRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    sellerMe()
      .then((m) => setStats(m.stats))
      .catch((e) => setError(getErrorMessage(e)));
    fetchMyOrders(1)
      .then((r) => setRecent(r.items.slice(0, 8)))
      .catch(() => undefined);
  }, []);

  if (!stats) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">Your sales on Bingoor.</div>
        </div>
      </div>
      <div className="grid grid-4">
        <StatCard label="Total revenue" value={money(stats.revenue)} icon={<IconRupee />} tone="var(--ok)" toneSoft="var(--ok-soft)" hint="From your products, cancelled orders left out" />
        <StatCard label="Total orders" value={String(stats.orders)} icon={<IconReceipt />} />
        <StatCard label="Live orders" value={String(stats.liveOrders ?? 0)} icon={<IconReceipt />} tone="var(--warn)" toneSoft="var(--warn-soft)" hint="Not delivered yet" />
        <StatCard label="Live listings" value={`${stats.liveListings} / ${stats.totalListings}`} icon={<IconBox />} />
      </div>
      <OrdersTable title="Latest orders" rows={recent} />
    </>
  );
}

export function ProductSellerOrders({ onSeen }: { onSeen?: () => void }) {
  const [rows, setRows] = useState<SellerOrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetchMyOrders(page, status)
      .then((r) => {
        setRows(r.items);
        setPages(r.totalPages);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, status]);
  useEffect(() => {
    load();
    onSeen?.();
  }, [load, onSeen]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <div className="page-subtitle">Orders that have your products. Bingoor packs and delivers them.</div>
        </div>
      </div>
      <div className="row-flex" style={{ marginBottom: 14 }}>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All orders</option>
          {Object.keys(STATUS_TONE).map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </div>
      <ErrorBanner message={error} />
      {loading ? <CenterSpinner /> : <OrdersTable rows={rows} />}
      <Pagination page={page} totalPages={pages} onChange={setPage} />
    </>
  );
}

function OrdersTable({ rows, title }: { rows: SellerOrderRow[]; title?: string }) {
  return (
    <div className="card" style={{ marginTop: title ? 18 : 0 }}>
      {title ? <h3 className="card-title" style={{ padding: '14px 16px 0' }}>{title}</h3> : null}
      {rows.length === 0 ? (
        <div className="empty-state">No orders yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Products</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o._id}>
                  <td>
                    <div style={{ fontWeight: 650 }}>{o.orderNumber}</div>
                    <div className="cell-muted">{formatDate(o.createdAt)}</div>
                  </td>
                  <td>
                    {o.items.map((i, n) => (
                      <div key={n}>
                        {i.name}
                        {i.unit ? <span className="cell-muted"> · {i.unit}</span> : null}
                      </div>
                    ))}
                  </td>
                  <td>
                    {o.items.map((i, n) => (
                      <div key={n}>× {i.quantity}</div>
                    ))}
                  </td>
                  <td>{money(o.amount)}</td>
                  <td>{payLabel(o)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[o.status] ?? 'muted'}>{label(o.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
