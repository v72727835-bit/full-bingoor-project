import React, { useEffect, useState } from 'react';
import { deleteUser, setRiderLongDistance, fetchRiders, setRiderPaused, settleRiderCod } from '../api/admin';
import { getErrorMessage } from '../api/client';
import CreateRiderModal from '../components/CreateRiderModal';
import { Badge, Button, CenterSpinner, ErrorBanner, money, timeAgo } from '../components/ui';
import { RiderRow, RiderTotals } from '../types';
import { useNavigate } from '../navigation';

const warehouseName = (r: RiderRow) => {
  const list = (r.warehouses ?? []).map((w) => w.name).filter(Boolean);
  if (list.length) return list.join(', ');
  return typeof r.warehouse === 'string' ? '—' : r.warehouse?.name ?? '—';
};

/**
 * Delivery partners at a glance: who is online, how much cash on delivery each
 * one is holding, how many orders they delivered or dropped, and who is paused.
 *
 * A rider is paused automatically once their uncollected cash reaches the limit
 * in Store settings; "Collected cash" clears what they owe and lets them resume.
 */
export default function RidersPage() {
  const navigate = useNavigate();
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [meta, setMeta] = useState<RiderTotals | null>(null);
  const [q, setQ] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RiderRow | undefined>();

  const load = () => {
    fetchRiders({ q: q || undefined, online: onlineOnly || undefined })
      .then(({ items, meta }) => {
        setRiders(items);
        setMeta(meta);
        setError('');
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  // Online status goes stale in two minutes, so refresh while the page is open.
  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, onlineOnly]);

  const act = async (id: string, run: () => Promise<void>) => {
    setBusy(id);
    try {
      await run();
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Riders</h1>
          <div className="page-subtitle">
            Online status, cash on delivery collected and pause control. Refreshes every 20 seconds. Riders sign in to the rider app with their phone number and password.
          </div>
        </div>
        <Button onClick={() => setAdding(true)}>+ New rider</Button>
      </div>

      {meta && (
        <div className="stat-row" style={{ marginBottom: 16 }}>
          <div className="card card-pad">
            <div className="stat-label">Cash to collect</div>
            <div className="stat-value">{money(meta.totals.codPending)}</div>
            <div className="cell-muted">Across all riders, not yet submitted</div>
          </div>
          <div className="card card-pad">
            <div className="stat-label">Collected all time</div>
            <div className="stat-value">{money(meta.totals.codCollected)}</div>
          </div>
          <div className="card card-pad">
            <div className="stat-label">Online now</div>
            <div className="stat-value">{meta.totals.online}</div>
            <div className="cell-muted">Auto-pause at {money(meta.codLimit)}</div>
          </div>
        </div>
      )}

      <div className="row-flex" style={{ marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or email" style={{ flex: 1 }} />
        <label className="checkbox-row">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
          <span>Only online</span>
        </label>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <CenterSpinner />
      ) : riders.length === 0 ? (
        <div className="card">
          <div className="empty-state">No riders found.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rider</th>
                  <th>Warehouses</th>
                  <th>Cash to collect</th>
                  <th>Delivered</th>
                  <th>Cancelled</th>
                  <th>Last seen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r._id}>
                    <td className="cell-name">
                      <span className={`dot${r.online ? ' dot-on' : ''}`} title={r.online ? 'Online' : 'Offline'} />
                      <button className="linklike" onClick={() => navigate(`/riders/${r._id}`)} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>{r.name}</button>
                      {r.paused && (
                        <>
                          {' '}
                          <Badge tone="danger">Paused</Badge>
                        </>
                      )}
                      <div className="cell-muted">{r.email ?? r.phone}</div>
                    </td>
                    <td className="cell-muted">{warehouseName(r)}</td>
                    <td className="cell-name">{money(r.codPending)}</td>
                    <td className="cell-muted">{r.deliveredCount}</td>
                    <td className="cell-muted">{r.cancelledCount}</td>
                    <td className="cell-muted">{r.lastSeenAt ? timeAgo(r.lastSeenAt) : 'Logged out'}</td>
                    <td>
                      <div className="row-flex">
                        <Button size="sm" variant="secondary" disabled={busy === r._id} onClick={() => setEditing(r)}>Edit</Button>
                        <Button size="sm" variant="ghost" disabled={busy === r._id} onClick={() => {
                          if (confirm(`Delete rider "${r.name}"? Their login will be disabled and order/payment history retained. Active deliveries and pending COD must be cleared first.`)) void act(r._id, () => deleteUser(r._id));
                        }}>Delete</Button>
                        {r.codPending > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy === r._id}
                            onClick={() => act(r._id, () => settleRiderCod(r._id))}
                          >
                            Collected cash
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={r.longDistance ? 'primary' : 'ghost'}
                          disabled={busy === r._id}
                          title="Only a long-distance rider receives orders from beyond the last delivery distance"
                          onClick={() => act(r._id, () => setRiderLongDistance(r._id, !r.longDistance))}
                        >
                          {r.longDistance ? 'Long distance ✓' : 'Long distance'}
                        </Button>
                        <Button
                          size="sm"
                          variant={r.paused ? 'primary' : 'ghost'}
                          disabled={busy === r._id}
                          onClick={() => act(r._id, () => setRiderPaused(r._id, !r.paused))}
                        >
                          {r.paused ? 'Resume' : 'Pause'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {adding && <CreateRiderModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      {editing && <CreateRiderModal rider={editing} onClose={() => setEditing(undefined)} onDone={() => { setEditing(undefined); load(); }} />}
    </>
  );
}
