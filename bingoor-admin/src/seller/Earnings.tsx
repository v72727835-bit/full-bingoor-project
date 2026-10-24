"use client";

import React, { useEffect, useState } from 'react';
import { SellerTxnRow, SellerWallet, sellerRequestWithdraw, sellerSaveWalletAccount, sellerWallet, sellerWalletTxns } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field, money, timeAgo } from '../components/ui';

/**
 * A seller's own earnings: how much their products sold for, the commission the
 * super admin kept, what is left to withdraw, and a request to be paid out.
 */
export default function Earnings() {
  const [w, setW] = useState<SellerWallet | null>(null);
  const [rows, setRows] = useState<SellerTxnRow[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [acct, setAcct] = useState({ upi: '', bankHolder: '', bankNumber: '', bankIfsc: '' });

  const load = () => {
    sellerWallet()
      .then((d) => {
        setW(d);
        setAcct({ upi: d.account?.upi ?? '', bankHolder: d.account?.bankHolder ?? '', bankNumber: d.account?.bankNumber ?? '', bankIfsc: d.account?.bankIfsc ?? '' });
        setError('');
      })
      .catch((e) => setError(getErrorMessage(e)));
    sellerWalletTxns({ page: 1, limit: 30 }).then(({ items }) => setRows(items)).catch(() => undefined);
  };
  useEffect(load, []);

  const saveAccount = async () => {
    setBusy('acct');
    setNote('');
    setError('');
    try {
      await sellerSaveWalletAccount({ upi: acct.upi || undefined, bankHolder: acct.bankHolder || undefined, bankNumber: acct.bankNumber || undefined, bankIfsc: acct.bankIfsc || undefined });
      setNote('Payout account saved.');
      load();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };

  const withdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter an amount to withdraw.'); return; }
    setBusy('wd');
    setNote('');
    setError('');
    try {
      await sellerRequestWithdraw(amt, method);
      setNote('Withdrawal requested. The Bingoor team will verify and pay it.');
      setAmount('');
      load();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(''); }
  };

  if (!w) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Earnings</h1>
          <div className="page-subtitle">Your product sales minus the {w.commissionPct}% platform commission. Withdraw your balance to your UPI or bank; the Bingoor team verifies and pays it.</div>
        </div>
      </div>

      <ErrorBanner message={error} />
      {note && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(40,180,90,.12)', color: 'var(--ok, #1a7f43)', fontSize: 14 }}>{note}</div>}

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="card card-pad"><div className="stat-label">Balance to withdraw</div><div className="stat-value">{money(w.balance)}</div></div>
        <div className="card card-pad"><div className="stat-label">Net earned (all time)</div><div className="stat-value">{money(w.netEarned)}</div></div>
        <div className="card card-pad"><div className="stat-label">Gross sales</div><div className="stat-value">{money(w.grossSales)}</div><div className="cell-muted">Commission kept: {money(w.commissionTotal)}</div></div>
        <div className="card card-pad"><div className="stat-label">Waiting / paid out</div><div className="stat-value">{money(w.pendingWithdraw)}</div><div className="cell-muted">Paid: {money(w.paidOut)}</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h2 className="card-title">Withdraw</h2>
          <div className="page-subtitle" style={{ marginBottom: 10 }}>Smallest withdrawal is {money(w.minWithdraw)}.</div>
          <Field label="Amount (₹)"><input value={amount} inputMode="numeric" onChange={(e) => setAmount(e.target.value)} placeholder={`up to ${Math.floor(w.balance)}`} /></Field>
          <Field label="Pay to">
            <select value={method} onChange={(e) => setMethod(e.target.value as 'upi' | 'bank')}>
              <option value="upi">UPI {acct.upi ? `(${acct.upi})` : ''}</option>
              <option value="bank">Bank {acct.bankNumber ? `(${acct.bankNumber})` : ''}</option>
            </select>
          </Field>
          <Button onClick={withdraw} disabled={busy === 'wd' || w.balance < w.minWithdraw}>{busy === 'wd' ? 'Requesting…' : 'Request withdrawal'}</Button>
        </div>

        <div className="card card-pad">
          <h2 className="card-title">Payout account</h2>
          <Field label="UPI id"><input value={acct.upi} onChange={(e) => setAcct({ ...acct, upi: e.target.value })} placeholder="name@bank" /></Field>
          <div className="page-subtitle" style={{ margin: '4px 0 8px' }}>…or a bank account:</div>
          <Field label="Account holder name"><input value={acct.bankHolder} onChange={(e) => setAcct({ ...acct, bankHolder: e.target.value })} /></Field>
          <div className="field-row">
            <Field label="Account number"><input value={acct.bankNumber} onChange={(e) => setAcct({ ...acct, bankNumber: e.target.value })} /></Field>
            <Field label="IFSC"><input value={acct.bankIfsc} onChange={(e) => setAcct({ ...acct, bankIfsc: e.target.value.toUpperCase() })} /></Field>
          </div>
          <Button variant="secondary" onClick={saveAccount} disabled={busy === 'acct'}>{busy === 'acct' ? 'Saving…' : 'Save account'}</Button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad"><h2 className="card-title">Passbook</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Entry</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state">No entries yet. Earnings appear here when your orders are delivered.</div></td></tr>
              ) : rows.map((t) => (
                <tr key={t._id}>
                  <td className="cell-name">
                    {t.kind === 'withdrawal' ? 'Withdrawal' : t.kind === 'adjustment' ? 'Adjustment' : 'Sale earning'}
                    <div className="cell-muted">{t.note || ''}{t.kind === 'earning' && t.gross != null ? ` · sold ${money(t.gross)}, commission ${money(t.commission ?? 0)}` : ''}</div>
                  </td>
                  <td className="cell-name">{t.kind === 'withdrawal' ? '-' : '+'}{money(t.amount)}</td>
                  <td><Badge tone={t.status === 'paid' || t.status === 'completed' ? 'success' : t.status === 'rejected' ? 'danger' : 'brand'}>{t.status}</Badge></td>
                  <td className="cell-muted">{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
