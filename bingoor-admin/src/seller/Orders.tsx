"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { sellerInvoiceLink, sellerOrders, sellerSetOrderStatus } from '../api/admin';
import { openBill } from '../lib/invoice';
import RiderCell from '../components/RiderCell';
import AssignPanel from './AssignPanel';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Pagination, Tabs, money, formatDate } from '../components/ui';
import { Order, PageMeta } from '../types';
import { statusLabel, statusTone } from './common';

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  placed: { to: 'accepted', label: 'Accept order' },
  accepted: { to: 'preparing', label: 'Start preparing' },
  preparing: { to: 'ready_for_pickup', label: 'Ready for pickup' },
};

const TABS = [
  ['', 'All'],
  ['placed', 'New'],
  ['accepted', 'Accepted'],
  ['preparing', 'Preparing'],
  ['ready_for_pickup', 'Ready'],
  ['out_for_delivery', 'On the way'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
] as const;

export default function Orders({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<Order[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    sellerOrders({ page, limit: 20, status: status || undefined, q: query || undefined })
      .then((r) => { setRows(r.items); setMeta(r.meta as PageMeta); })
      .catch((e) => setError(getErrorMessage(e)));
  }, [page, status, query]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const move = async (id: string, to: string) => {
    if (to === 'rejected' && !window.confirm('Reject this order? The customer will be told it was cancelled.')) return;
    setBusy(id);
    setError('');
    try {
      await sellerSetOrderStatus(id, to);
      load();
      onChanged();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <div className="page-subtitle">Accept new orders, prepare them and hand them to a free rider.</div>
        </div>
        <form className="row-flex" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order number" style={{ width: 200 }} />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>
      <Tabs
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
        options={TABS.map(([value, label]) => ({ value, label }))}
      />
      <ErrorBanner message={error} />
      {!rows ? (
        <CenterSpinner />
      ) : rows.length === 0 ? (
        <div className="card"><div className="empty-state">No orders here.</div></div>
      ) : (
        rows.map((o) => {
          const next = NEXT[o.status];
          const rider = typeof o.rider === 'object' ? o.rider : null;
          const customer = typeof o.user === 'object' ? o.user : null;
          const expanded = open === o._id;
          return (
            <div key={o._id} className="card card-pad" style={{ marginBottom: 12 }}>
              <div className="row-flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b>#{o.orderNumber}</b> <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                  <div className="cell-muted">
                    {typeof o.shop === 'object' ? o.shop.name : ''} · {formatDate(o.createdAt)} · {o.paymentMethod === 'cod' ? 'Cash on delivery' : `Online (${o.paymentStatus})`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b>{money(o.total)}</b>
                  <div className="cell-muted">{o.items.length} item{o.items.length === 1 ? '' : 's'}</div>
                </div>
              </div>

              <div className="cell-muted" style={{ margin: '8px 0' }}>{o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</div>
              {(rider || o.riderPool) && (
                <div style={{ marginBottom: 8 }}><b>Rider:</b> <RiderCell order={o} /></div>
              )}

              <div className="row-flex" style={{ flexWrap: 'wrap' }}>
                {next && <Button size="sm" disabled={busy === o._id} onClick={() => move(o._id, next.to)}>{next.label}</Button>}
                {o.status === 'placed' && <Button size="sm" variant="ghost" disabled={busy === o._id} onClick={() => move(o._id, 'rejected')}>Reject</Button>}
                {['accepted', 'preparing', 'ready_for_pickup'].includes(o.status) && !o.rider && o.fulfillment !== 'shiprocket' && (
                  <Button size="sm" variant="secondary" onClick={() => setAssigning(assigning === o._id ? null : o._id)}>
                    {assigning === o._id ? 'Close' : 'Rider / Shiprocket'}
                  </Button>
                )}
                {['accepted', 'preparing', 'ready_for_pickup'].includes(o.status) && (
                  <Button size="sm" variant="ghost" disabled={busy === o._id} onClick={() => move(o._id, 'cancelled')}>Cancel</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => openBill(() => sellerInvoiceLink(o._id), 'a4').catch((e) => setError(getErrorMessage(e)))}>Invoice</Button>
                <Button size="sm" variant="secondary" onClick={() => openBill(() => sellerInvoiceLink(o._id), 'pos').catch((e) => setError(getErrorMessage(e)))}>POS bill</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(expanded ? null : o._id)}>{expanded ? 'Hide details' : 'Details'}</Button>
                {o.fulfillment === 'shiprocket' && (
                  <span className="cell-muted">📦 Shiprocket{o.shiprocket?.courier ? ` · ${o.shiprocket.courier}` : ''}{o.shiprocket?.awb ? ` · AWB ${o.shiprocket.awb}` : ''}</span>
                )}
              </div>

              {assigning === o._id && (
                <AssignPanel orderId={o._id} onAssigned={() => { setAssigning(null); load(); onChanged(); }} />
              )}

              {expanded && (
                <div className="grid grid-2" style={{ marginTop: 12 }}>
                  <div>
                    <h4 className="card-title">Customer and address</h4>
                    <div>{o.address.name} · {o.address.phone}</div>
                    <div className="cell-muted">
                      {[o.address.line1, o.address.line2, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(', ')}
                    </div>
                    {customer && <div className="cell-muted">Account: {customer.name} ({customer.phone})</div>}
                    {o.note && <div className="cell-muted">Note: {o.note}</div>}
                  </div>
                  <div>
                    <h4 className="card-title">Items</h4>
                    {o.items.map((i) => (
                      <div key={`${i.product}-${i.unit}`} className="row-flex" style={{ justifyContent: 'space-between' }}>
                        <span>{i.name} <span className="cell-muted">{i.unit} × {i.quantity}</span></span>
                        <span>{money(i.lineTotal)}</span>
                      </div>
                    ))}
                    <hr style={{ opacity: 0.15 }} />
                    <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="cell-muted">Subtotal</span><span>{money(o.subtotal)}</span></div>
                    <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="cell-muted">Delivery</span><span>{money(o.deliveryFee)}</span></div>
                    {o.discount > 0 && <div className="row-flex" style={{ justifyContent: 'space-between' }}><span className="cell-muted">Discount</span><span>-{money(o.discount)}</span></div>}
                    <div className="row-flex" style={{ justifyContent: 'space-between' }}><b>Total</b><b>{money(o.total)}</b></div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
    </>
  );
}
