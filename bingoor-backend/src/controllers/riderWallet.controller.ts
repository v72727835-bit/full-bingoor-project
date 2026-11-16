import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { WalletTxn } from '../models/WalletTxn';
import { ApiError } from '../utils/ApiError';
import { isDuplicateKey } from '../utils/helpers';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import { codSummary } from '../services/rider.service';
import { earningsSeries, payRules, walletSummary } from '../services/riderPay.service';
import { loadSettings } from '../services/settings.service';
import { payoutForWithdrawal, razorpayxConfig, syncPayout } from '../services/razorpayx.service';

/** Everything the wallet screen shows at the top: balance, earnings, cash owed, saved account. */
export const getWallet = asyncHandler(async (req, res) => {
  const id = req.user!.id;
  const { settings } = await loadSettings();
  const rules = payRules(settings);
  // If a RazorpayX payout is in flight for this rider, refresh its real status first.
  const inflight = await WalletTxn.findOne({ rider: id, kind: 'withdrawal', status: 'pending', payoutId: { $exists: true } }).select('_id').lean();
  if (inflight) await syncPayout(inflight._id).catch(() => undefined);
  const [sum, cod, me] = await Promise.all([
    walletSummary(id),
    codSummary([new Types.ObjectId(id)]),
    User.findById(id).select('payout').lean(),
  ]);
  const c = cod.get(id);
  ok(res, {
    ...sum,
    codPending: c?.pending ?? 0,
    codCollected: c?.total ?? 0,
    codLimit: settings.riderCodLimit ?? 2000,
    minWithdraw: rules.minWithdraw,
    account: me?.payout ?? null,
    payEnabled: rules.enabled,
  });
});

/** The passbook: every earning, bonus, withdrawal and cash submit, newest first. */
export const listWalletTxns = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
  const filter: Record<string, unknown> = { rider: req.user!.id };
  if (kind) filter.kind = kind;
  const [rows, total] = await Promise.all([
    WalletTxn.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    WalletTxn.countDocuments(filter),
  ]);
  ok(res, rows, pageMeta(page, limit, total));
});

/**
 * Earnings for the graph: a per-day total for the last `days` days, plus the
 * today / week / month roll-ups.
 */
export const earningsSummary = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 14;
  ok(res, await earningsSeries(req.user!.id, days));
});

/** Save or update where the rider gets paid. */
export const saveAccount = asyncHandler(async (req, res) => {
  const { upi, bankHolder, bankNumber, bankIfsc } = req.body as { upi?: string; bankHolder?: string; bankNumber?: string; bankIfsc?: string };
  if (!upi && !(bankHolder && bankNumber && bankIfsc)) {
    throw new ApiError(400, 'Add a UPI id, or the full bank account (holder name, number and IFSC).');
  }
  const payout = { upi: upi || undefined, bankHolder: bankHolder || undefined, bankNumber: bankNumber || undefined, bankIfsc: bankIfsc || undefined };
  await User.updateOne({ _id: req.user!.id }, { $set: { payout } });
  ok(res, payout);
});

/** The rider asks to withdraw part of their balance; an admin pays it out later. */
export const requestWithdraw = asyncHandler(async (req, res) => {
  const { amount, method } = req.body as { amount: number; method: 'upi' | 'bank' };
  const { settings } = await loadSettings();
  const rules = payRules(settings);
  const me = await User.findById(req.user!.id).select('payout').lean();
  const payout = me?.payout;
  const destination = method === 'upi' ? payout?.upi : payout?.bankNumber ? `${payout.bankHolder ?? ''} · ${payout.bankNumber} · ${payout.bankIfsc ?? ''}` : undefined;
  if (!destination) throw new ApiError(400, method === 'upi' ? 'Add your UPI id first.' : 'Add your bank account first.');

  const open = await WalletTxn.exists({ rider: req.user!.id, kind: 'withdrawal', status: 'pending' });
  if (open) throw new ApiError(409, 'You already have a withdrawal waiting. Please wait until it is paid.');

  const sum = await walletSummary(req.user!.id);
  if (amount < rules.minWithdraw) throw new ApiError(400, `The smallest withdrawal is ₹${rules.minWithdraw}.`);
  if (amount > sum.balance) throw new ApiError(400, `You can withdraw up to ₹${Math.floor(sum.balance)}.`);

  // The unique "one pending withdrawal" index makes a second parallel request fail here.
  const txn = await WalletTxn.create({ rider: req.user!.id, kind: 'withdrawal', amount: Math.round(amount), status: 'pending', method, destination, note: 'Withdrawal request' }).catch((e) => {
    if (isDuplicateKey(e)) throw new ApiError(409, 'You already have a withdrawal waiting. Please wait until it is paid.');
    throw e;
  });

  // When RazorpayX is on in fully-automatic mode, pay it out at once. If the
  // payout call fails, the request simply stays pending for an admin to handle,
  // so the rider never loses the money.
  const cfg = await razorpayxConfig();
  if (cfg?.autoPayout) {
    try {
      await payoutForWithdrawal(txn._id);
    } catch {
      /* leave it pending for the admin */
    }
  }
  const fresh = await WalletTxn.findById(txn._id).lean();
  ok(res, fresh ?? txn, undefined, 201);
});

/** The rider records that they handed collected COD cash to the office. */
export const submitCash = asyncHandler(async (req, res) => {
  const { amount, note } = req.body as { amount: number; note?: string };
  const cod = (await codSummary([new Types.ObjectId(req.user!.id)])).get(req.user!.id);
  const pending = cod?.pending ?? 0;
  if (pending <= 0) throw new ApiError(400, 'You have no cash to submit right now.');
  const open = await WalletTxn.exists({ rider: req.user!.id, kind: 'cash_submit', status: 'pending' });
  if (open) throw new ApiError(409, 'A cash submission is already waiting for the office to confirm.');
  const amt = Math.min(Math.round(amount || pending), Math.round(pending));
  const txn = await WalletTxn.create({ rider: req.user!.id, kind: 'cash_submit', amount: amt, status: 'pending', note: note || 'Cash handed to office' }).catch((e) => {
    if (isDuplicateKey(e)) throw new ApiError(409, 'A cash submission is already waiting for the office to confirm.');
    throw e;
  });
  ok(res, txn, undefined, 201);
});
