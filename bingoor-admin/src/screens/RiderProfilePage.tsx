import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchRiderProfile, giveRiderBonus, markWithdrawal, RiderProfileFull, setRiderPaused, settleRiderCod } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useNavigate } from '../navigation';
import { Badge, Button, CenterSpinner, ErrorBanner, money, timeAgo } from '../components/ui';

const KIND_LABEL: Record<string, string> = { earning: 'Delivery earning', bonus: 'Bonus', adjustment: 'Adjustment', withdrawal: 'Withdrawal', cash_submit: 'Cash submitted' };
const dayShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** The full page a super admin sees when they open one rider: who they are, their money, and a report. */
export default function RiderProfilePage({ riderId }: { riderId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<RiderProfileFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetchRiderProfile(riderId)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [riderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    try { await run(); load(); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  if (loading) return <CenterSpinner />;
  if (!data) return <ErrorBanner message={error || 'Rider not found'} />;
  const { rider, finance, analytics, recentTxns, withdrawals } = data;
  const chart = analytics.series.map((s) => ({ ...s, label: dayShort(s.date) }));

  return (
    <>
      <div className="page-header">
        <div>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/riders')} style={{ marginBottom: 8 }}>← Back to riders</button>
          <h1 className="page-title">
            <span className={`dot${rider.online ? ' dot-on' : ''}`} style={{ marginRight: 8 }} />
            {rider.name}
            {rider.paused ? <> <Badge tone="danger">Paused</Badge></> : null}
            {rider.longDistance ? <> <Badge tone="brand">Long distance</Badge></> : null}
          </h1>
          <div className="page-subtitle">{rider.phone}{rider.email ? ` · ${rider.email}` : ''} · joined {new Date(rider.createdAt).toLocaleDateString('en-IN')} · {rider.online ? 'online now' : rider.lastSeenAt ? `last seen ${timeAgo(rider.lastSeenAt)}` : 'logged out'}</div>
        </div>
      </div>

      <ErrorBanner message={error} />

      {/* Finance */}
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="card card-pad"><div className="stat-label">Wallet balance</div><div className="stat-value">{money(finance.balance)}</div><div className="cell-muted">Withdrawable now</div></div>
        <div className="card card-pad"><div className="stat-label">Total earned</div><div className="stat-value">{money(finance.lifetimeEarned)}</div><div className="cell-muted">{analytics.delivered} deliveries · avg {money(analytics.avgPerDelivery)}</div></div>
        <div className="card card-pad"><div className="stat-label">Pending withdrawal</div><div className="stat-value">{money(finance.pendingWithdraw)}</div><div className="cell-muted">Paid out {money(finance.withdrawnTotal)} all time</div></div>
        <div className="card card-pad"><div className="stat-label">Cash to collect</div><div className="stat-value">{money(finance.codPending)}</div><div className="cell-muted">Collected {money(finance.codCollected)} total</div></div>
        <div className="card card-pad"><div className="stat-label">COD collected today</div><div className="stat-value">{money(finance.codToday ?? 0)}</div><div className="cell-muted">Cancelled orders {rider.cancelledCount ?? analytics.cancelled ?? 0}</div></div>
      </div>

      {/* Report */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Earnings — last 14 days</h2>
        <div className="row-flex" style={{ gap: 20, margin: '6px 0 14px' }}>
          <span className="cell-muted">Today <b style={{ color: 'var(--ink, #0f172a)' }}>{money(analytics.today)}</b></span>
          <span className="cell-muted">This week <b style={{ color: 'var(--ink, #0f172a)' }}>{money(analytics.week)}</b></span>
          <span className="cell-muted">14 days <b style={{ color: 'var(--ink, #0f172a)' }}>{money(analytics.month)}</b></span>
          <span className="cell-muted">Deliveries <b style={{ color: 'var(--ink, #0f172a)' }}>{analytics.deliveries}</b></span>
          <span className="cell-muted">Cancelled <b style={{ color: 'var(--ink, #0f172a)' }}>{analytics.cancelled}</b></span>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 4, right: 10, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Bar dataKey="amount" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Details + account */}
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="card card-pad" style={{ flex: 1 }}>
          <h2 className="card-title">Warehouses</h2>
          {rider.warehouses.length === 0 ? <div className="cell-muted">None assigned.</div> : rider.warehouses.map((w) => <div key={w._id} className="cell-name" style={{ padding: '4px 0' }}>{w.name}</div>)}
        </div>
        <div className="card card-pad" style={{ flex: 1 }}>
          <h2 className="card-title">Payout account</h2>
          {rider.payout?.upi ? <div className="cell-name">UPI: {rider.payout.upi}</div> : null}
          {rider.payout?.bankNumber ? <div className="cell-muted">{rider.payout.bankHolder} · {rider.payout.bankNumber} · {rider.payout.bankIfsc}</div> : null}
          {!rider.payout?.upi && !rider.payout?.bankNumber ? <div className="cell-muted">Rider has not added an account yet.</div> : null}
        </div>
      </div>

      {/* Actions */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Actions</h2>
        <div className="row-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" variant={rider.paused ? 'primary' : 'ghost'} disabled={busy} onClick={() => act(() => setRiderPaused(rider._id, !rider.paused))}>{rider.paused ? 'Resume rider' : 'Pause rider'}</Button>
          {finance.codPending > 0 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => settleRiderCod(rider._id))}>Collected cash ({money(finance.codPending)})</Button>}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
            const v = window.prompt('Bonus amount (₹) to add to this rider\'s wallet:');
            const amt = Number(v);
            if (amt > 0) act(() => giveRiderBonus(rider._id, amt, 'Bonus from admin'));
          }}>Give bonus</Button>
        </div>
      </div>

      {/* Withdrawals */}
      {withdrawals.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row-flex" style={{ padding: 14 }}><h2 className="card-title" style={{ margin: 0 }}>Withdrawals</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Amount</th><th>To</th><th>When</th><th>Status</th><th /></tr></thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w._id}>
                  <td className="cell-name">{money(w.amount)}</td>
                  <td className="cell-muted">{w.method === 'upi' ? 'UPI' : 'Bank'} · {w.destination || '—'}</td>
                  <td className="cell-muted">{timeAgo(w.createdAt)}</td>
                  <td><Badge tone={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'danger' : 'brand'}>{w.status}</Badge>{w.reference ? <div className="cell-muted" style={{ fontSize: 12 }}>Ref: {w.reference}</div> : null}</td>
                  <td>{w.status === 'pending' && (
                    <div className="row-flex">
                      <Button size="sm" disabled={busy} onClick={() => { const r = window.prompt('Payment reference (optional):') ?? undefined; act(() => markWithdrawal(w._id, 'paid', r || undefined)); }}>Mark paid</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => markWithdrawal(w._id, 'rejected'))}>Reject</Button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Passbook */}
      <div className="card">
        <div className="row-flex" style={{ padding: 14 }}><h2 className="card-title" style={{ margin: 0 }}>Recent passbook</h2></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Type</th><th>Details</th><th>When</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {recentTxns.length === 0 ? <tr><td colSpan={4} className="empty-state">No transactions yet.</td></tr> : recentTxns.map((t) => {
              const out = t.kind === 'withdrawal' || t.kind === 'cash_submit';
              return (
                <tr key={t._id}>
                  <td className="cell-name">{KIND_LABEL[t.kind] ?? t.kind}</td>
                  <td className="cell-muted">{t.note || '—'}{t.km ? ` · ${t.km} km` : ''}{t.status !== 'completed' ? ` · ${t.status}` : ''}</td>
                  <td className="cell-muted">{timeAgo(t.createdAt)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: out ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)' }}>{out ? '-' : '+'}{money(t.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
