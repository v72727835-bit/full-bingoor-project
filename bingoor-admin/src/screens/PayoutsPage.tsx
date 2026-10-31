import React, { useEffect, useState } from 'react';
import {
  fetchIntegrations,
  fetchSellerWithdrawals,
  fetchWithdrawals,
  markSellerWithdrawal,
  markWithdrawal,
  paySellerWithdrawal,
  payWithdrawal,
  SellerWithdrawal,
  Withdrawal,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, money, timeAgo } from '../components/ui';

/** Normalised view of one payout row, whether it belongs to a rider or a seller. */
interface Row {
  _id: string;
  who: string;
  phone: string;
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  method?: 'upi' | 'bank';
  destination?: string;
  reference?: string;
  payoutId?: string;
  payoutStatus?: string;
  createdAt: string;
}

const fromRider = (w: Withdrawal): Row => ({
  ...w,
  who: typeof w.rider === 'string' ? '—' : w.rider?.name ?? '—',
  phone: typeof w.rider === 'string' ? '' : w.rider?.phone ?? '',
});
const fromSeller = (w: SellerWithdrawal): Row => ({
  ...w,
  who: typeof w.seller === 'string' ? '—' : w.seller?.name ?? '—',
  phone: typeof w.seller === 'string' ? '' : w.seller?.phone ?? '',
});

/**
 * Where you pay your riders and sellers. Each row is a withdrawal someone asked
 * for from their earnings; verify it, then pay it (one click via RazorpayX when
 * it is switched on, or mark it paid after paying by hand), or reject it.
 */
export default function PayoutsPage() {
  const [tab, setTab] = useState<'rider' | 'seller'>('rider');
  const [status, setStatus] = useState<'pending' | 'paid' | 'rejected' | 'all'>('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [autoPay, setAutoPay] = useState(false);

  useEffect(() => {
    fetchIntegrations().then((d) => setAutoPay(d.live.razorpayx)).catch(() => undefined);
  }, []);

  const load = () => {
    setLoading(true);
    const req = tab === 'rider'
      ? fetchWithdrawals(status).then(({ items, meta }) => ({ rows: items.map(fromRider), meta }))
      : fetchSellerWithdrawals(status).then(({ items, meta }) => ({ rows: items.map(fromSeller), meta }));
    req
      .then(({ rows, meta }) => { setRows(rows); setPendingTotal(meta.pendingTotal ?? 0); setError(''); })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [status, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const whom = tab === 'rider' ? 'rider' : 'seller';
  const doMark = (id: string, next: 'paid' | 'rejected', reference?: string) =>
    tab === 'rider' ? markWithdrawal(id, next, reference) : markSellerWithdrawal(id, next, reference);
  const doPay = (id: string) => (tab === 'rider' ? payWithdrawal(id) : paySellerWithdrawal(id));

  const act = async (w: Row, next: 'paid' | 'rejected') => {
    let reference: string | undefined;
    if (next === 'paid') {
      reference = window.prompt(`Mark ₹${Math.round(w.amount)} to ${w.who} as paid.\n\nEnter the UPI / bank reference (optional):`) ?? undefined;
      if (reference === undefined) return; // cancelled
    } else if (!window.confirm(`Reject this ₹${Math.round(w.amount)} withdrawal? The amount goes back to the ${whom}'s balance.`)) {
      return;
    }
    setBusy(w._id);
    try { await doMark(w._id, next, reference || undefined); load(); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(null); }
  };

  const pay = async (w: Row) => {
    if (!window.confirm(`Pay ₹${Math.round(w.amount)} to ${w.who} now via RazorpayX?\n\nThe money will be sent to ${w.destination || 'their saved account'}.`)) return;
    setBusy(w._id);
    try { await doPay(w._id); load(); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payouts</h1>
          <div className="page-subtitle">Pay riders and sellers the earnings they withdraw. Verify, then pay to the UPI / bank shown (one click with RazorpayX) or mark it paid.</div>
        </div>
      </div>

      <div className="row-flex" style={{ marginBottom: 14, gap: 8 }}>
        <button className="chip" data-active={tab === 'rider'} onClick={() => setTab('rider')}>Riders</button>
        <button className="chip" data-active={tab === 'seller'} onClick={() => setTab('seller')}>Sellers</button>
      </div>

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <div className="stat-label">Waiting to pay ({tab === 'rider' ? 'riders' : 'sellers'})</div>
          <div className="stat-value">{money(pendingTotal)}</div>
          <div className="cell-muted">Across all pending requests</div>
        </div>
      </div>

      <div className="row-flex" style={{ marginBottom: 14, gap: 8 }}>
        {(['pending', 'paid', 'rejected', 'all'] as const).map((s) => (
          <button key={s} className="chip" data-active={status === s} onClick={() => setStatus(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {loading ? <CenterSpinner /> : rows.length === 0 ? (
        <div className="card"><div className="empty-state">No {status === 'all' ? '' : status} {whom} withdrawals.</div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{tab === 'rider' ? 'Rider' : 'Seller'}</th><th>Amount</th><th>Pay to</th><th>Requested</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w._id}>
                    <td className="cell-name">{w.who}<div className="cell-muted">{w.phone}</div></td>
                    <td className="cell-name">{money(w.amount)}</td>
                    <td className="cell-muted">
                      {w.method === 'upi' ? 'UPI' : 'Bank'}
                      <div className="cell-muted" style={{ fontSize: 12 }}>{w.destination || '—'}</div>
                    </td>
                    <td className="cell-muted">{timeAgo(w.createdAt)}</td>
                    <td>
                      <Badge tone={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'danger' : 'brand'}>{w.status}</Badge>
                      {w.reference ? <div className="cell-muted" style={{ fontSize: 12 }}>Ref: {w.reference}</div> : null}
                    </td>
                    <td>
                      {w.status === 'pending' && (
                        <div className="row-flex">
                          {autoPay && !w.payoutId && (
                            <Button size="sm" disabled={busy === w._id} onClick={() => pay(w)}>Approve &amp; Pay</Button>
                          )}
                          {w.payoutId ? (
                            <span className="cell-muted" style={{ fontSize: 12 }}>Payout {w.payoutStatus || 'processing'}…</span>
                          ) : (
                            <Button size="sm" variant={autoPay ? 'secondary' : 'primary'} disabled={busy === w._id} onClick={() => act(w, 'paid')}>Mark paid</Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={busy === w._id} onClick={() => act(w, 'rejected')}>Reject</Button>
                        </div>
                      )}
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
