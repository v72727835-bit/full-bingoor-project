import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from '../navigation';
import AssignRider from '../components/AssignRider';
import RiderCell from '../components/RiderCell';
import { adminAssignRider, adminAssignShiprocket, adminFreeRiders, adminInvoiceLink, fetchOrder, fetchOrders, fetchShops, refundOrder, updateOrderStatus } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { playChime } from '../lib/alerts';
import { openBill } from '../lib/invoice';
import { IconBolt, IconReceipt, IconVolume, IconVolumeOff } from '../components/icons';
import {
  Badge,
  Button,
  CenterSpinner,
  ErrorBanner,
  Modal,
  Pagination,
  Tabs,
  Tone,
  formatDate,
  money,
  timeAgo,
} from '../components/ui';
import { ADMIN_NEXT, Order, ORDER_STATUSES, OrderStatus, PageMeta, Shop } from '../types';

export function statusLabel(s: OrderStatus): string {
  return s
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function statusTone(s: OrderStatus): Tone {
  if (s === 'delivered') return 'success';
  if (s === 'cancelled' || s === 'rejected') return 'danger';
  if (s === 'placed') return 'info';
  if (s === 'out_for_delivery') return 'brand';
  return 'warn';
}

/** One colour per status, shared by the donut, the pulse chart and the feed. */
export const STATUS_COLOR: Record<string, string> = {
  placed: '#4d8dff',
  accepted: '#7c6cff',
  preparing: '#ff9f43',
  ready_for_pickup: '#ffc93c',
  out_for_delivery: '#3bc9f5',
  delivered: '#2ed47a',
  cancelled: '#ff5470',
  rejected: '#8a94ac',
};

const LIVE_STATUSES: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

type View = 'all' | 'live' | 'delivered' | 'cancelled';

/** Minutes waiting → traffic-light colour, so an ageing order stands out before it becomes a complaint. */
function slaTone(minutes: number): { tone: Tone; label: string } {
  if (minutes < 15) return { tone: 'success', label: 'On time' };
  if (minutes < 30) return { tone: 'warn', label: 'Slow' };
  return { tone: 'danger', label: 'Delayed' };
}

function AgeBadge({ createdAt }: { createdAt: string }) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  const { tone, label } = slaTone(minutes);
  return (
    <Badge tone={tone}>
      {label} · {minutes}m
    </Badge>
  );
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>(params.get('live') ? 'live' : 'all');
  const [status, setStatus] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState('');
  const [riderQ, setRiderQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(params.get('id'));
  const [soundOn, setSoundOn] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    fetchShops({ page: 1, limit: 100 })
      .then(({ items }) => setShops(items))
      .catch(() => undefined);
  }, []);

  const load = () => {
    setLoading(true);
    const wanted =
      status ||
      (view === 'delivered' ? 'delivered' : view === 'cancelled' ? 'cancelled' : undefined);

    fetchOrders({ page, limit: view === 'live' ? 50 : 20, status: wanted, q: q || undefined, rider: riderQ || undefined })
      .then(({ items, meta }) => {
        let list = view === 'live' && !status ? items.filter((o) => LIVE_STATUSES.includes(o.status)) : items;
        if (shopFilter) list = list.filter((o) => (typeof o.shop === 'string' ? o.shop : o.shop?._id) === shopFilter);
        if (view === 'live') list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // spot orders that weren't here on the last poll, so the live board can flash + chime for them
        if (view === 'live' && knownIds.current) {
          const arrived = list.filter((o) => !knownIds.current!.has(o._id)).map((o) => o._id);
          if (arrived.length > 0) {
            setNewIds(new Set(arrived));
            if (soundOn) playChime();
            setTimeout(() => setNewIds(new Set()), 6000);
          }
        }
        if (view === 'live') knownIds.current = new Set(list.map((o) => o._id));

        setOrders(list);
        setMeta(meta);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, status, view, shopFilter]);

  // the live board refreshes itself so the kitchen screen stays current
  useEffect(() => {
    if (view !== 'live') return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, page, status, q, riderQ, shopFilter, soundOn]);

  const switchView = (v: View) => {
    setView(v);
    setStatus('');
    setPage(1);
    knownIds.current = null;
    setParams(v === 'live' ? { live: '1' } : {}, { replace: true });
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const advance = async (o: Order) => {
    const idx = ORDER_STATUSES.indexOf(o.status);
    const next = idx >= 0 && idx < 3 ? ORDER_STATUSES[idx + 1] : null; // stops at ready for pickup; a rider takes it from there
    if (!next) return;
    setAdvancingId(o._id);
    try {
      await updateOrderStatus(o._id, next);
      setOrders((list) => list.map((x) => (x._id === o._id ? { ...x, status: next } : x)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAdvancingId(null);
    }
  };

  const overdue = orders.filter((o) => view === 'live' && (Date.now() - new Date(o.createdAt).getTime()) / 60000 >= 30).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{view === 'live' ? 'Live orders' : 'Orders'}</h1>
          <div className="page-subtitle">
            {view === 'live'
              ? 'Oldest waiting order first — refreshes every 20 seconds.'
              : meta
                ? `${meta.total} orders`
                : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {view === 'live' && overdue > 0 && <span className="badge badge-danger">{overdue} delayed 30m+</span>}
          {view === 'live' && (
            <button className="icon-btn" title={soundOn ? 'Mute new-order sound' : 'Unmute new-order sound'} onClick={() => setSoundOn((s) => !s)}>
              {soundOn ? <IconVolume size={16} /> : <IconVolumeOff size={16} />}
            </button>
          )}
          {view === 'live' && (
            <span className="live-pill">
              <span className="pulse-dot" />
              {orders.length} in flight
            </span>
          )}
        </div>
      </div>

      <div className="toolbar">
        <Tabs
          value={view}
          onChange={switchView}
          options={[
            { value: 'live', label: 'Live' },
            { value: 'all', label: 'All' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <select
          value={shopFilter}
          onChange={(e) => {
            setShopFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: 170 }}
        >
          <option value="">All shops</option>
          {shops.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <form className="toolbar" style={{ margin: 0, flex: 1 }} onSubmit={search}>
          <input
            className="search-input"
            placeholder="Search by order number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            className="search-input"
            placeholder="Search by delivery boy name…"
            value={riderQ}
            onChange={(e) => setRiderQ(e.target.value)}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            style={{ width: 180 }}
          >
            <option value="">Any status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <ErrorBanner message={error} />

      <div className="card">
        {loading ? (
          <div style={{ padding: 40 }}>
            <CenterSpinner />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            {view === 'live' ? 'No live orders right now — everything is delivered.' : 'No orders found.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Shop</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Rider</th>
                  <th>{view === 'live' ? 'Waiting' : 'Payment'}</th>
                  <th>Total</th>
                  <th>{view === 'live' ? '' : 'Placed'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const user = typeof o.user === 'string' ? null : o.user;
                  const shop = typeof o.shop === 'string' ? null : o.shop;
                  const idx = ORDER_STATUSES.indexOf(o.status);
                  const next = idx >= 0 && idx < 3 ? ORDER_STATUSES[idx + 1] : null; // stops at ready for pickup; a rider takes it from there
                  return (
                    <tr key={o._id} className={newIds.has(o._id) ? 'row-new' : undefined}>
                      <td className="cell-name">#{o.orderNumber}</td>
                      <td>
                        {user?.name ?? '—'}
                        <div className="cell-muted">{user?.phone}</div>
                      </td>
                      <td>{shop?.name ?? '—'}</td>
                      <td className="cell-muted">{o.items?.length ?? 0}</td>
                      <td>
                        <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                      </td>
                      <td>
                        <RiderCell order={o} stacked />
                      </td>
                      <td className="cell-muted">
                        {view === 'live' ? <AgeBadge createdAt={o.createdAt} /> : o.paymentMethod.toUpperCase()}
                      </td>
                      <td className="cell-name">{money(o.total)}</td>
                      <td className="cell-muted">{view === 'live' ? '' : formatDate(o.createdAt)}</td>
                      <td>
                        <div className="row-flex">
                          {view === 'live' && next && (
                            <Button size="sm" disabled={advancingId === o._id} onClick={() => advance(o)}>
                              <IconBolt size={13} /> {statusLabel(next)}
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setOpenId(o._id)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && view !== 'live' && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}

      {openId && (
        <OrderDetail
          id={openId}
          onClose={() => {
            setOpenId(null);
            if (params.get('id')) setParams(view === 'live' ? { live: '1' } : {}, { replace: true });
          }}
          onChanged={load}
        />
      )}
    </>
  );
}

/* ---------------- detail drawer ---------------- */

function OrderDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');

  const load = () => {
    fetchOrder(id)
      .then((o) => {
        setOrder(o);
        setNextStatus(o.status);
      })
      .catch((err) => setError(getErrorMessage(err)));
  };
  useEffect(load, [id]);

  const apply = async (target?: OrderStatus) => {
    const to = target ?? nextStatus;
    if (!to || !order || to === order.status) return;
    setSaving(true);
    setError('');
    try {
      await updateOrderStatus(id, to, note || undefined);
      onChanged();
      load();
      setNote('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const refund = async () => {
    if (!order || !window.confirm(`Refund ${order.total ? '₹' + order.total : 'this order'} back to the customer via Razorpay?`)) return;
    setSaving(true);
    setError('');
    try {
      await refundOrder(id);
      onChanged();
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!order) {
    return (
      <Modal title="Order" onClose={onClose}>
        <CenterSpinner />
      </Modal>
    );
  }

  const user = typeof order.user === 'string' ? null : order.user;
  const shop = typeof order.shop === 'string' ? null : order.shop;
  const idx = ORDER_STATUSES.indexOf(order.status);
  const nextUp = idx >= 0 && idx < 5 ? ORDER_STATUSES[idx + 1] : null;

  return (
    <Modal title={`Order #${order.orderNumber}`} onClose={onClose} wide>
      <ErrorBanner message={error} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
        {nextUp && order.status !== 'delivered' && (
          <Button size="sm" onClick={() => apply(nextUp)} disabled={saving}>
            <IconBolt size={14} /> Move to {statusLabel(nextUp)}
          </Button>
        )}
        {!['delivered', 'cancelled', 'rejected'].includes(order.status) && (
          <Button size="sm" variant="danger" onClick={() => apply('cancelled')} disabled={saving}>
            Cancel order
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => openBill(() => adminInvoiceLink(order._id), 'a4').catch((e) => setError(getErrorMessage(e)))}>
          Invoice (A4)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => openBill(() => adminInvoiceLink(order._id), 'pos').catch((e) => setError(getErrorMessage(e)))}>
          POS bill
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, fontSize: 13.5 }}>
        <div>
          <div className="stat-label">Customer</div>
          <div>{user?.name}</div>
          <div className="cell-muted">{user?.phone}</div>
        </div>
        <div>
          <div className="stat-label">Shop</div>
          <div>{shop?.name}</div>
        </div>
        <div>
          <div className="stat-label">Payment</div>
          <div>
            {order.paymentMethod.toUpperCase()} · {order.paymentStatus}
          </div>
        </div>
        <div>
          <div className="stat-label">Placed</div>
          <div>{formatDate(order.createdAt)}</div>
        </div>
      </div>

      <div className="stat-label" style={{ marginBottom: 6 }}>
        Deliver to
      </div>
      <div style={{ fontSize: 13.5, marginBottom: 16 }}>
        {order.address.name} · {order.address.phone}
        <br />
        <span className="cell-muted">
          {order.address.line1}, {order.address.city}, {order.address.state} - {order.address.pincode}
        </span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i}>
                  <td className="cell-name">{it.name}</td>
                  <td>{it.quantity}</td>
                  <td>{money(it.price)}</td>
                  <td>{money(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 13.5, marginBottom: 20 }}>
        <div style={{ minWidth: 230 }}>
          <Row label="Subtotal" value={money(order.subtotal)} />
          <Row label="Delivery fee" value={money(order.deliveryFee)} />
          {order.discount > 0 && <Row label="Discount" value={`-${money(order.discount)}`} />}
          <Row label="Total" value={money(order.total)} bold />
        </div>
      </div>

      {order.fulfillment === 'shiprocket' && order.shiprocket && (
        <div style={{ margin: '14px 0', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(124,108,255,.06)' }}>
          <div className="stat-label" style={{ marginBottom: 4 }}>📦 Shipped via Shiprocket</div>
          <div className="cell-muted">
            {order.shiprocket.courier ? `Courier: ${order.shiprocket.courier}` : 'Courier being assigned'}
            {order.shiprocket.awb ? ` · AWB ${order.shiprocket.awb}` : ''}
            {order.shiprocket.orderId ? ` · Shiprocket #${order.shiprocket.orderId}` : ''}
          </div>
        </div>
      )}

      {['accepted', 'preparing', 'ready_for_pickup'].includes(order.status) && !order.rider && order.fulfillment !== 'shiprocket' && (
        <AssignRider
          load={() => adminFreeRiders(id)}
          assign={(rid) => adminAssignRider(id, rid)}
          assignShiprocket={() => adminAssignShiprocket(id)}
          onAssigned={() => {
            onChanged();
            load();
          }}
        />
      )}

      <div className="stat-label" style={{ marginBottom: 6 }}>
        Change status
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)} style={{ width: 180 }}>
          {[order.status, ...(ADMIN_NEXT[order.status] ?? [])].map((s) => (
            <option key={s} value={s}>
              {s === order.status ? `${statusLabel(s)} (current)` : statusLabel(s)}
            </option>
          ))}
        </select>
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <Button size="sm" onClick={() => apply()} disabled={saving || nextStatus === order.status}>
          {saving ? 'Saving…' : 'Update'}
        </Button>
        {order.paymentMethod === 'online' && order.paymentStatus !== 'refunded' && (
          <Button size="sm" variant="secondary" onClick={refund} disabled={saving}>
            {order.paymentStatus === 'refund_pending' ? 'Refund now' : 'Refund'}
          </Button>
        )}
        {order.paymentStatus === 'refunded' && <span className="cell-muted">Refunded</span>}
      </div>

      <div className="stat-label" style={{ marginTop: 18, marginBottom: 6 }}>
        Timeline
      </div>
      <div>
        {order.statusHistory.map((h, i) => (
          <div className="feed-item" key={i}>
            <span
              className="feed-icon"
              style={{ background: 'rgba(255,255,255,.05)', color: STATUS_COLOR[h.status] ?? 'var(--ink-soft)' }}
            >
              <IconReceipt size={14} />
            </span>
            <div className="feed-text">
              <b>{statusLabel(h.status)}</b>
              {h.note ? ` — ${h.note}` : ''}
            </div>
            <span className="feed-time">{formatDate(h.at)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: bold ? 700 : 400 }}>
      <span className={bold ? '' : 'cell-muted'}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

