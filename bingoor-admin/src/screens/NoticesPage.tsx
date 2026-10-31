import React, { useEffect, useState } from 'react';
import { createNotice, deleteNotice, fetchNotices, fetchStockAlerts, setStockAlertNotified, deleteStockAlert } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, Pagination, Tabs, Thumb, timeAgo } from '../components/ui';
import { Notice, PageMeta, StockAlert } from '../types';

/**
 * Two inboxes in one page:
 *   • Announcements — messages pushed to every customer's notification bell.
 *   • Back-in-stock requests — the numbers customers left on "Notify me".
 */
export default function NoticesPage() {
  const [tab, setTab] = useState<'notices' | 'alerts'>('notices');

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <div className="page-subtitle">Announcements for every customer, and the people waiting for a product to return.</div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'notices', label: 'Announcements' },
          { value: 'alerts', label: 'Back in stock requests' },
        ]}
      />

      {tab === 'notices' ? <Announcements /> : <StockRequests />}
    </>
  );
}

function Announcements() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    fetchNotices()
      .then(setNotices)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await createNotice(message.trim());
      setMessage('');
      setError('');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement? It disappears from every customer’s bell.')) return;
    try {
      await deleteNotice(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <ErrorBanner message={error} />

      <form className="card card-pad" style={{ marginBottom: 18 }} onSubmit={send}>
        <Field label="Message for every customer">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            placeholder="Free delivery on all orders this weekend!"
          />
        </Field>
        <div className="modal-actions">
          <Button type="submit" disabled={sending || !message.trim()}>
            {sending ? 'Sending…' : 'Send to all customers'}
          </Button>
        </div>
      </form>

      {loading ? (
        <CenterSpinner />
      ) : notices.length === 0 ? (
        <div className="card">
          <div className="empty-state">No announcements yet.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Sent</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n._id}>
                    <td className="cell-name">{n.message}</td>
                    <td className="cell-muted">{timeAgo(n.createdAt)}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => remove(n._id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function StockRequests() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchStockAlerts({ page, limit: 20 })
      .then(({ items, meta }) => {
        setAlerts(items);
        setMeta(meta);
        setError('');
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  const update = async (run: () => Promise<unknown>) => {
    try {
      await run();
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <ErrorBanner message={error} />

      {loading ? (
        <CenterSpinner />
      ) : alerts.length === 0 ? (
        <div className="card">
          <div className="empty-state">Nobody is waiting for a product right now.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Mobile</th>
                  <th>Stock</th>
                  <th>Asked</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => {
                  const product = typeof a.product === 'string' ? null : a.product;
                  return (
                    <tr key={a._id}>
                      <td className="cell-name">
                        <div className="row-flex">
                          <Thumb src={product?.images?.[0]} />
                          <span>{product?.name ?? 'Deleted product'}</span>
                        </div>
                      </td>
                      <td className="cell-name">{a.phone}</td>
                      <td>
                        {product && product.stock > 0 ? (
                          <Badge tone="success">Back in stock</Badge>
                        ) : (
                          <Badge tone="muted">Out of stock</Badge>
                        )}
                      </td>
                      <td className="cell-muted">{timeAgo(a.createdAt)}</td>
                      <td>
                        <div className="row-flex">
                          <Button
                            size="sm"
                            variant={a.notified ? 'ghost' : 'secondary'}
                            onClick={() => update(() => setStockAlertNotified(a._id, !a.notified))}
                          >
                            {a.notified ? 'Informed ✓' : 'Mark informed'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => update(() => deleteStockAlert(a._id))}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && <Pagination page={page} totalPages={meta.totalPages} onChange={setPage} />}
    </>
  );
}
