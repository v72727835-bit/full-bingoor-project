import crypto from 'crypto';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { WalletTxn } from '../models/WalletTxn';
import { ApiError } from '../utils/ApiError';
import { getIntegrations } from './integrations.service';

/**
 * RazorpayX payouts: pay a rider's withdrawal straight to their saved UPI or
 * bank account. We keep a RazorpayX "contact" per rider and a "fund account"
 * per saved UPI/bank (recreating the fund account only when the rider changes
 * their details), then create a payout from the business RazorpayX account.
 *
 * A withdrawal WalletTxn stays `pending` (money held) until RazorpayX confirms
 * the payout processed (then `paid`) or it fails/reverses (then `rejected`, so
 * the balance returns to the rider).
 */
const BASE = 'https://api.razorpay.com/v1';

export interface RazorpayxConfig {
  accountNumber: string;
  keyId: string;
  keySecret: string;
  autoPayout: boolean;
}

export async function razorpayxConfig(): Promise<RazorpayxConfig | null> {
  const x = (await getIntegrations()).razorpayx;
  return x.enabled && x.accountNumber && x.keyId && x.keySecret
    ? { accountNumber: x.accountNumber, keyId: x.keyId, keySecret: x.keySecret, autoPayout: x.autoPayout }
    : null;
}

export const razorpayxEnabled = async (): Promise<boolean> => !!(await razorpayxConfig());

async function call<T>(method: 'GET' | 'POST', path: string, body: unknown, cfg: RazorpayxConfig, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64'),
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['X-Payout-Idempotency'] = idempotencyKey;
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = (await r.json().catch(() => ({}))) as { error?: { description?: string }; [k: string]: unknown };
  if (!r.ok) throw new ApiError(502, j.error?.description || 'RazorpayX did not accept this request. Please try again.');
  return j as T;
}

/** A short fingerprint of the rider's current payout details, so we recreate the fund account when they change. */
function fingerprint(payout: { upi?: string; bankNumber?: string; bankIfsc?: string } | undefined, method: 'upi' | 'bank'): string {
  return method === 'upi' ? `upi:${payout?.upi ?? ''}` : `bank:${payout?.bankNumber ?? ''}:${payout?.bankIfsc ?? ''}`;
}

/** Make sure the rider has a RazorpayX contact and a fund account for the chosen method; returns the fund account id. */
async function ensureFundAccount(riderId: string, method: 'upi' | 'bank', cfg: RazorpayxConfig): Promise<string> {
  const rider = await User.findById(riderId).select('name phone payout');
  if (!rider) throw new ApiError(404, 'Rider not found');
  const payout = rider.payout;
  const fp = fingerprint(payout, method);
  if (payout?.rzpFundAccountId && payout.rzpFundFingerprint === fp) return payout.rzpFundAccountId;

  let contactId = payout?.rzpContactId;
  if (!contactId) {
    const contact = await call<{ id: string }>('POST', '/contacts', { name: rider.name || 'Rider', contact: rider.phone, type: 'vendor', reference_id: String(rider._id) }, cfg);
    contactId = contact.id;
  }

  let fundAccountId: string;
  if (method === 'upi') {
    if (!payout?.upi) throw new ApiError(400, 'The rider has not added a UPI id.');
    const fa = await call<{ id: string }>('POST', '/fund_accounts', { contact_id: contactId, account_type: 'vpa', vpa: { address: payout.upi } }, cfg);
    fundAccountId = fa.id;
  } else {
    if (!payout?.bankNumber || !payout.bankIfsc) throw new ApiError(400, 'The rider has not added a full bank account.');
    const fa = await call<{ id: string }>('POST', '/fund_accounts', { contact_id: contactId, account_type: 'bank_account', bank_account: { name: payout.bankHolder || rider.name || 'Rider', ifsc: payout.bankIfsc, account_number: payout.bankNumber } }, cfg);
    fundAccountId = fa.id;
  }
  await User.updateOne({ _id: rider._id }, { $set: { 'payout.rzpContactId': contactId, 'payout.rzpFundAccountId': fundAccountId, 'payout.rzpFundFingerprint': fp } });
  return fundAccountId;
}

const DONE: Record<string, 'paid' | 'rejected' | null> = {
  processed: 'paid',
  reversed: 'rejected',
  cancelled: 'rejected',
  rejected: 'rejected',
  failed: 'rejected',
};

/** How a payout status maps onto our held/settled states, for both rider and seller ledgers. */
export const payoutSettlement = (status: string): 'paid' | 'rejected' | null => DONE[status] ?? null;

/** Create a RazorpayX payout to any user's saved UPI/bank. Returns the payout id and status. */
export async function createUserPayout(
  userId: string | Types.ObjectId,
  amountRupees: number,
  method: 'upi' | 'bank',
  referenceId: string,
  narration: string,
): Promise<{ payoutId: string; status: string }> {
  const cfg = await razorpayxConfig();
  if (!cfg) throw new ApiError(400, 'RazorpayX payouts are not switched on.');
  const fundAccountId = await ensureFundAccount(String(userId), method, cfg);
  const payout = await call<{ id: string; status: string }>(
    'POST',
    '/payouts',
    {
      account_number: cfg.accountNumber,
      fund_account_id: fundAccountId,
      amount: Math.round(amountRupees * 100),
      currency: 'INR',
      mode: method === 'upi' ? 'UPI' : 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: referenceId,
      narration,
    },
    cfg,
    `pay_${referenceId}`,
  );
  return { payoutId: payout.id, status: payout.status };
}

/** Read a payout's current status from RazorpayX (used to settle a held withdrawal). */
export async function fetchPayoutStatus(payoutId: string): Promise<string | null> {
  const cfg = await razorpayxConfig();
  if (!cfg) return null;
  const payout = await call<{ status: string }>('GET', `/payouts/${payoutId}`, undefined, cfg);
  return payout.status;
}

/**
 * Create a RazorpayX payout for a pending withdrawal and record its id/status.
 * Leaves the withdrawal `pending` while the payout is still in flight; a later
 * sync (webhook or wallet refresh) settles it to `paid` or `rejected`.
 */
export async function payoutForWithdrawal(txnId: string | Types.ObjectId): Promise<void> {
  const cfg = await razorpayxConfig();
  if (!cfg) throw new ApiError(400, 'RazorpayX payouts are not switched on.');
  const txn = await WalletTxn.findOne({ _id: txnId, kind: 'withdrawal' });
  if (!txn) throw new ApiError(404, 'Withdrawal not found');
  if (txn.status !== 'pending') throw new ApiError(409, 'This withdrawal was already handled.');
  if (txn.payoutId) throw new ApiError(409, 'A payout was already started for this withdrawal.');
  const method = txn.method === 'bank' ? 'bank' : 'upi';
  const fundAccountId = await ensureFundAccount(String(txn.rider), method, cfg);
  const payout = await call<{ id: string; status: string }>(
    'POST',
    '/payouts',
    {
      account_number: cfg.accountNumber,
      fund_account_id: fundAccountId,
      amount: Math.round(txn.amount * 100),
      currency: 'INR',
      mode: method === 'upi' ? 'UPI' : 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: String(txn._id),
      narration: 'Bingoor rider payout',
    },
    cfg,
    `wd_${txn._id}`, // idempotency: one payout per withdrawal, even on a retry
  );
  txn.payoutId = payout.id;
  txn.payoutStatus = payout.status;
  txn.reference = payout.id;
  const settled = DONE[payout.status];
  if (settled) txn.status = settled;
  txn.note = `RazorpayX payout ${payout.status}`;
  await txn.save();
}

/** Re-read a payout's real status from RazorpayX and settle the withdrawal if it finished. */
export async function syncPayout(txnId: string | Types.ObjectId): Promise<void> {
  const cfg = await razorpayxConfig();
  if (!cfg) return;
  const txn = await WalletTxn.findOne({ _id: txnId, kind: 'withdrawal' });
  if (!txn || !txn.payoutId || txn.status !== 'pending') return;
  const payout = await call<{ status: string }>('GET', `/payouts/${txn.payoutId}`, undefined, cfg);
  txn.payoutStatus = payout.status;
  const settled = DONE[payout.status];
  if (settled) {
    txn.status = settled;
    txn.note = `RazorpayX payout ${payout.status}`;
  }
  await txn.save();
}

/** Settle a withdrawal from a RazorpayX webhook; we re-fetch the real status rather than trusting the body. */
export async function syncPayoutById(payoutId: string): Promise<void> {
  const txn = await WalletTxn.findOne({ kind: 'withdrawal', payoutId }).select('_id');
  if (txn) await syncPayout(txn._id);
}

/** Admin "Test": a harmless read that fails when the keys or account number are wrong. */
export async function testRazorpayx() {
  const cfg = await razorpayxConfig();
  if (!cfg) throw new ApiError(400, 'Save the RazorpayX account number, key id and key secret first, and switch RazorpayX on.');
  await call('GET', '/contacts?count=1', undefined, cfg);
  return { ok: true, accountNumber: cfg.accountNumber };
}

/** Optional webhook signature check, when a webhook secret is configured in the environment. */
export function verifyRazorpayxWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
