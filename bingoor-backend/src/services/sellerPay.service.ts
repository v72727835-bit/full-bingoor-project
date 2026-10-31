import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { SellerTxn } from '../models/SellerTxn';
import { ApiError } from '../utils/ApiError';
import { loadSettings } from './settings.service';
import { createUserPayout, fetchPayoutStatus, payoutSettlement, razorpayxConfig } from './razorpayx.service';

/** The commission percent the super admin keeps on a seller's item sales. */
export function commissionPct(settings: { sellerPay?: { commissionPct?: number } }): number {
  const pct = settings.sellerPay?.commissionPct;
  return typeof pct === 'number' && pct >= 0 && pct <= 100 ? pct : 10;
}

export function sellerMinWithdraw(settings: { sellerPay?: { minWithdraw?: number } }): number {
  const m = settings.sellerPay?.minWithdraw;
  return typeof m === 'number' && m >= 0 ? m : 500;
}

/**
 * Credit each seller in a delivered order with their net earning (item sales
 * minus the super admin's commission). Idempotent: a unique index stops a
 * second credit for the same seller+order, so calling it again is safe.
 */
export async function creditSellerEarnings(orderId: Types.ObjectId | string): Promise<void> {
  const order = await Order.findById(orderId).select('items orderNumber status').lean();
  if (!order || order.status !== 'delivered') return;
  const { settings } = await loadSettings();
  const pct = commissionPct(settings);

  // Sum item sales per seller (items without a seller are the store's own stock).
  const bySeller = new Map<string, number>();
  for (const it of order.items) {
    if (!it.seller) continue;
    const key = String(it.seller);
    bySeller.set(key, (bySeller.get(key) ?? 0) + (it.lineTotal ?? 0));
  }

  for (const [sellerId, gross] of bySeller) {
    const commission = Math.round(((gross * pct) / 100) * 100) / 100;
    const net = Math.round((gross - commission) * 100) / 100;
    try {
      await SellerTxn.create({
        seller: new Types.ObjectId(sellerId),
        kind: 'earning',
        amount: net,
        status: 'completed',
        order: order._id,
        gross: Math.round(gross * 100) / 100,
        commission,
        commissionPct: pct,
        note: `Order #${order.orderNumber}`,
      });
    } catch (e) {
      // Duplicate key = already credited for this order; ignore.
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }
}

/** A seller's money at a glance: gross sales, commission taken, net earned, balance and payouts. */
export async function sellerWalletSummary(sellerId: Types.ObjectId | string) {
  const rows = await SellerTxn.aggregate<{ _id: { kind: string; status: string }; total: number; gross: number; commission: number }>([
    { $match: { seller: new Types.ObjectId(String(sellerId)) } },
    { $group: { _id: { kind: '$kind', status: '$status' }, total: { $sum: '$amount' }, gross: { $sum: { $ifNull: ['$gross', 0] } }, commission: { $sum: { $ifNull: ['$commission', 0] } } } },
  ]);
  let credit = 0; // earnings + positive adjustments
  let grossSales = 0;
  let commissionTotal = 0;
  let withdrawHeld = 0; // pending + paid withdrawals
  let pendingWithdraw = 0;
  for (const r of rows) {
    const { kind, status } = r._id;
    if (kind === 'earning' || kind === 'adjustment') {
      credit += r.total;
      grossSales += r.gross;
      commissionTotal += r.commission;
    } else if (kind === 'withdrawal' && (status === 'pending' || status === 'paid')) {
      withdrawHeld += r.total;
      if (status === 'pending') pendingWithdraw += r.total;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    balance: round(Math.max(0, credit - withdrawHeld)),
    netEarned: round(credit),
    grossSales: round(grossSales),
    commissionTotal: round(commissionTotal),
    pendingWithdraw: round(pendingWithdraw),
    paidOut: round(withdrawHeld - pendingWithdraw),
  };
}

/** Create a RazorpayX payout for a seller's pending withdrawal and record its id/status. */
export async function paySellerWithdrawal(txnId: string | Types.ObjectId): Promise<void> {
  const cfg = await razorpayxConfig();
  if (!cfg) throw new ApiError(400, 'RazorpayX payouts are not switched on.');
  const txn = await SellerTxn.findOne({ _id: txnId, kind: 'withdrawal' });
  if (!txn) throw new ApiError(404, 'Withdrawal not found');
  if (txn.status !== 'pending') throw new ApiError(409, 'This withdrawal was already handled.');
  if (txn.payoutId) throw new ApiError(409, 'A payout was already started for this withdrawal.');
  const method = txn.method === 'bank' ? 'bank' : 'upi';
  const { payoutId, status } = await createUserPayout(txn.seller, txn.amount, method, String(txn._id), 'Bingoor seller payout');
  txn.payoutId = payoutId;
  txn.payoutStatus = status;
  txn.reference = payoutId;
  const settled = payoutSettlement(status);
  if (settled) txn.status = settled;
  txn.note = `RazorpayX payout ${status}`;
  await txn.save();
}

/** Refresh an in-flight seller payout and settle it if it finished. */
export async function syncSellerPayout(txnId: string | Types.ObjectId): Promise<void> {
  const txn = await SellerTxn.findOne({ _id: txnId, kind: 'withdrawal' });
  if (!txn || !txn.payoutId || txn.status !== 'pending') return;
  const status = await fetchPayoutStatus(txn.payoutId);
  if (!status) return;
  txn.payoutStatus = status;
  const settled = payoutSettlement(status);
  if (settled) {
    txn.status = settled;
    txn.note = `RazorpayX payout ${status}`;
  }
  await txn.save();
}

export async function syncSellerPayoutById(payoutId: string): Promise<void> {
  const txn = await SellerTxn.findOne({ kind: 'withdrawal', payoutId }).select('_id');
  if (txn) await syncSellerPayout(txn._id);
}
