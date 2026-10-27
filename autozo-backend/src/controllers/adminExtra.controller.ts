import { FilterQuery, Types } from 'mongoose';
import { AdminAlert } from '../models/AdminAlert';
import { MediaItem } from '../models/MediaItem';
import { Notice } from '../models/Notice';
import { IOrder, Order } from '../models/Order';
import { Enquiry } from '../models/Enquiry';
import { Integrations } from '../models/Integrations';
import { Product } from '../models/Product';
import { Settings } from '../models/Settings';
import { StandardCategory } from '../models/StandardCategory';
import { StockAlert } from '../models/StockAlert';
import { Ticket } from '../models/Ticket';
import { User } from '../models/User';
import { WalletTxn } from '../models/WalletTxn';
import { walletSummary, earningsSeries } from '../services/riderPay.service';
import { clearCatalogCache } from '../middleware/cache';
import { getIntegrations, invalidateIntegrations } from '../services/integrations.service';
import { razorpayKeys, testRazorpayKeys } from '../services/razorpay.service';
import { testShiprocket } from '../services/shiprocket.service';
import { payoutForWithdrawal, razorpayxConfig, syncPayout, syncPayoutById, testRazorpayx } from '../services/razorpayx.service';
import { SellerTxn } from '../models/SellerTxn';
import { paySellerWithdrawal, syncSellerPayout, syncSellerPayoutById } from '../services/sellerPay.service';
import { seal } from '../utils/secretBox';
import { checkServiceAccount, pushToUsers } from '../services/firebase.service';
import { codSummary, ONLINE_WINDOW_MS } from '../services/rider.service';
import { presentMedia } from '../services/media.service';
import { getSettingsDoc } from '../services/settings.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { escapeRegex } from '../utils/helpers';
import { created, ok, pageMeta } from '../utils/response';

/* ============ Settings (festival tab, 6-day aisles, COD, rider limit, app links) ============ */

export const getSettings = asyncHandler(async (_req, res) => {
  await getSettingsDoc(); // creates the defaults on first use
  const settings = await Settings.findOne({ key: 'global' })
    .populate('festival.sections.category', 'name slug level')
    .populate('sixDay.categories', 'name slug level')
    .populate('cod.disabledCategories', 'name slug level')
    .populate('cartPoints.suggestions', 'name unit')
    .lean();
  ok(res, settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  await getSettingsDoc();
  const body = req.body as Record<string, Record<string, unknown> | number | undefined>;
  // Flatten one level so a partial update ({ festival: { name } }) keeps the other festival fields.
  const $set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [inner, v] of Object.entries(value)) $set[`${key}.${inner}`] = v;
    } else $set[key] = value;
  }
  await Settings.updateOne({ key: 'global' }, { $set });
  clearCatalogCache();
  const settings = await Settings.findOne({ key: 'global' })
    .populate('festival.sections.category', 'name slug level')
    .populate('sixDay.categories', 'name slug level')
    .populate('cod.disabledCategories', 'name slug level')
    .populate('cartPoints.suggestions', 'name unit')
    .lean();
  ok(res, settings);
});

/* ============ Notification bell broadcasts ============ */

export const listNoticesAdmin = asyncHandler(async (_req, res) => {
  ok(res, await Notice.find().sort({ createdAt: -1 }).limit(100).lean());
});

export const createNotice = asyncHandler(async (req, res) => {
  const { message } = req.body as { message: string };
  created(res, await Notice.create({ message }));
});

export const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await Notice.findByIdAndDelete(req.params.id);
  if (!notice) throw new ApiError(404, 'Notification not found');
  ok(res, { message: 'Notification deleted' });
});

/* ============ Chat with customer care ============ */

export const listTicketsAdmin = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const filter = status ? { status } : {};
  const [tickets, total, unread] = await Promise.all([
    Ticket.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name phone email')
      .lean(),
    Ticket.countDocuments(filter),
    Ticket.countDocuments({ adminUnread: { $gt: 0 } }),
  ]);
  ok(res, tickets, { ...pageMeta(page, limit, total), unread });
});

export const getTicketAdmin = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findByIdAndUpdate(req.params.id, { $set: { adminUnread: 0 } }, { new: true })
    .populate('user', 'name phone email')
    .lean();
  if (!ticket) throw new ApiError(404, 'Chat not found');
  ok(res, ticket);
});

/** Each admin reply adds one to the customer's unread badge. */
export const replyTicketAdmin = asyncHandler(async (req, res) => {
  const { text } = req.body as { text: string };
  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    {
      $push: { messages: { from: 'admin', text, at: new Date() } },
      $inc: { customerUnread: 1 },
      $set: { adminUnread: 0, lastMessageAt: new Date() },
    },
    { new: true },
  )
    .populate('user', 'name phone email')
    .lean();
  if (!ticket) throw new ApiError(404, 'Chat not found');
  ok(res, ticket);
});

export const setTicketStatus = asyncHandler(async (req, res) => {
  const { status } = req.body as { status: 'open' | 'closed' };
  const ticket = await Ticket.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).lean();
  if (!ticket) throw new ApiError(404, 'Chat not found');
  ok(res, ticket);
});

/* ============ "Notify me" requests ============ */

export const listStockAlerts = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const [alerts, total] = await Promise.all([
    StockAlert.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('product', 'name slug unit stock images icon')
      .populate('user', 'name')
      .lean(),
    StockAlert.countDocuments(),
  ]);
  ok(res, alerts, pageMeta(page, limit, total));
});

export const updateStockAlert = asyncHandler(async (req, res) => {
  const { notified } = req.body as { notified: boolean };
  const alert = await StockAlert.findByIdAndUpdate(req.params.id, { $set: { notified } }, { new: true }).lean();
  if (!alert) throw new ApiError(404, 'Request not found');
  ok(res, alert);
});

export const deleteStockAlert = asyncHandler(async (req, res) => {
  const alert = await StockAlert.findByIdAndDelete(req.params.id);
  if (!alert) throw new ApiError(404, 'Request not found');
  ok(res, { message: 'Deleted' });
});

/* ============ Riders: online, COD, pause ============ */

/**
 * Riders with live status: online (app active in the last 2 minutes), COD
 * cash collected and not yet submitted, deliveries, cancellations, paused.
 */
export const listRidersAdmin = asyncHandler(async (req, res) => {
  const { q, online } = req.query as unknown as { q?: string; online?: boolean };
  const filter: Record<string, unknown> = { role: 'rider', deletedAt: { $exists: false } };
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  if (online) filter.lastSeenAt = { $gte: since };

  const riders = await User.find(filter)
    .sort({ lastSeenAt: -1, name: 1 })
    .select('name phone email warehouse warehouses isActive lastSeenAt lastLoginAt riderPaused riderPausedAt riderCancelCount riderLongDistance')
    .populate('warehouse', 'name')
    .populate('warehouses', 'name')
    .lean();
  const cod = await codSummary(riders.map((r) => r._id as Types.ObjectId));

  const rows = riders.map((r) => {
    const c = cod.get(String(r._id));
    return {
      ...r,
      online: !!r.lastSeenAt && r.lastSeenAt >= since,
      codPending: c?.pending ?? 0,
      codCollected: c?.total ?? 0,
      deliveredCount: c?.deliveries ?? 0,
      cancelledCount: r.riderCancelCount ?? 0,
      paused: !!r.riderPaused,
      longDistance: !!r.riderLongDistance,
    };
  });
  const totals = rows.reduce(
    (t, r) => ({ codPending: t.codPending + r.codPending, codCollected: t.codCollected + r.codCollected, online: t.online + (r.online ? 1 : 0) }),
    { codPending: 0, codCollected: 0, online: 0 },
  );
  const { riderCodLimit } = await getSettingsDoc();
  ok(res, rows, { totals, codLimit: riderCodLimit ?? 2000 });
});

export const setRiderPaused = asyncHandler(async (req, res) => {
  const { paused } = req.body as { paused: boolean };
  const rider = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'rider' },
    { $set: { riderPaused: paused, riderPausedAt: paused ? new Date() : null } },
    { new: true },
  )
    .select('name riderPaused riderPausedAt')
    .lean();
  if (!rider) throw new ApiError(404, 'Rider not found');
  ok(res, rider);
});

/** The rider handed their COD cash to the cash department: clear what they owe. */
export const settleRiderCod = asyncHandler(async (req, res) => {
  const result = await Order.updateMany(
    { rider: req.params.id, status: 'delivered', paymentMethod: 'cod', codSettled: { $ne: true } },
    { $set: { codSettled: true } },
  );
  ok(res, { settledOrders: result.modifiedCount });
});

/* ============ Rider profile (super admin) ============ */

/** Everything about one rider on a single page: details, money, and a report. */
export const getRiderProfileAdmin = asyncHandler(async (req, res) => {
  const rider = await User.findOne({ _id: req.params.id, role: 'rider' })
    .select('name phone email isActive riderPaused riderPausedAt riderCancelCount riderLongDistance lastSeenAt createdAt payout warehouse warehouses')
    .populate('warehouse', 'name')
    .populate('warehouses', 'name')
    .lean();
  if (!rider) throw new ApiError(404, 'Rider not found');

  const riderId = new Types.ObjectId(req.params.id);
  const [wallet, analytics, cod, delivered, cancelled, recentTxns, withdrawals] = await Promise.all([
    walletSummary(riderId),
    earningsSeries(riderId, 14),
    codSummary([riderId]),
    Order.countDocuments({ rider: riderId, status: 'delivered' }),
    Order.countDocuments({ rider: riderId, status: 'cancelled' }),
    WalletTxn.find({ rider: riderId }).sort({ createdAt: -1 }).limit(15).lean(),
    WalletTxn.find({ rider: riderId, kind: 'withdrawal' }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const c = cod.get(req.params.id);
  const online = !!rider.lastSeenAt && Date.now() - new Date(rider.lastSeenAt).getTime() < 2 * 60_000;
  const avgPerDelivery = delivered > 0 ? Math.round(wallet.lifetimeEarned / delivered) : 0;

  ok(res, {
    rider: {
      _id: rider._id,
      name: rider.name,
      phone: rider.phone,
      email: rider.email ?? null,
      isActive: rider.isActive,
      paused: !!rider.riderPaused,
      pausedAt: rider.riderPausedAt ?? null,
      longDistance: !!rider.riderLongDistance,
      online,
      lastSeenAt: rider.lastSeenAt ?? null,
      createdAt: rider.createdAt,
      warehouses: rider.warehouses?.length ? rider.warehouses : rider.warehouse ? [rider.warehouse] : [],
      payout: rider.payout ?? null,
    },
    finance: {
      balance: wallet.balance,
      lifetimeEarned: wallet.lifetimeEarned,
      pendingWithdraw: wallet.pendingWithdraw,
      withdrawnTotal: wallet.withdrawnTotal,
      codPending: c?.pending ?? 0,
      codCollected: c?.total ?? 0,
    },
    analytics: { ...analytics, delivered, cancelled, avgPerDelivery },
    recentTxns,
    withdrawals,
  });
});

/* ============ Rider payouts ============ */

/** Pending and recent withdrawal requests across all riders. */
export const listWithdrawals = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { kind: 'withdrawal' };
  if (status && status !== 'all') filter.status = status;
  // Refresh any in-flight RazorpayX payouts so the queue shows their real state.
  const inflight = await WalletTxn.find({ kind: 'withdrawal', status: 'pending', payoutId: { $exists: true } }).select('_id').limit(25).lean();
  if (inflight.length) await Promise.all(inflight.map((t) => syncPayout(t._id).catch(() => undefined)));
  const [rows, total] = await Promise.all([
    WalletTxn.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('rider', 'name phone payout').lean(),
    WalletTxn.countDocuments(filter),
  ]);
  const pendingTotal = (await WalletTxn.aggregate<{ t: number }>([{ $match: { kind: 'withdrawal', status: 'pending' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]))[0]?.t ?? 0;
  ok(res, rows, { ...pageMeta(page, limit, total), pendingTotal });
});

/** Mark a withdrawal paid (with a reference) or reject it. */
export const markWithdrawal = asyncHandler(async (req, res) => {
  const { status, reference } = req.body as { status: 'paid' | 'rejected'; reference?: string };
  const txn = await WalletTxn.findOne({ _id: req.params.id, kind: 'withdrawal' });
  if (!txn) throw new ApiError(404, 'Withdrawal not found');
  if (txn.status !== 'pending') throw new ApiError(409, 'This withdrawal was already handled.');
  txn.status = status;
  if (reference) txn.reference = reference;
  await txn.save();
  ok(res, txn);
});

/** Approve a pending withdrawal and pay it out automatically through RazorpayX. */
export const payWithdrawalAdmin = asyncHandler(async (req, res) => {
  const cfg = await razorpayxConfig();
  if (!cfg) throw new ApiError(400, 'RazorpayX payouts are not switched on. Set it up in Integrations, or use “Mark paid” after paying by hand.');
  await payoutForWithdrawal(String(req.params.id));
  const txn = await WalletTxn.findById(req.params.id).lean();
  ok(res, txn);
});

/** Validates the saved RazorpayX account number and keys against RazorpayX. */
export const testRazorpayxAdmin = asyncHandler(async (_req, res) => {
  ok(res, await testRazorpayx());
});

/** RazorpayX payout webhook: we re-fetch the payout's real status rather than trusting the body. */
export const razorpayxWebhook = asyncHandler(async (req, res) => {
  const payoutId = (req.body as { payload?: { payout?: { entity?: { id?: string } } } })?.payload?.payout?.entity?.id;
  if (payoutId) {
    await syncPayoutById(payoutId).catch(() => undefined); // a rider payout…
    await syncSellerPayoutById(payoutId).catch(() => undefined); // …or a seller payout
  }
  ok(res, { received: true });
});

/* ============ Seller payouts ============ */

/** Pending and recent seller withdrawal requests across all sellers. */
export const listSellerWithdrawals = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { kind: 'withdrawal' };
  if (status && status !== 'all') filter.status = status;
  const inflight = await SellerTxn.find({ kind: 'withdrawal', status: 'pending', payoutId: { $exists: true } }).select('_id').limit(25).lean();
  if (inflight.length) await Promise.all(inflight.map((t) => syncSellerPayout(t._id).catch(() => undefined)));
  const [rows, total] = await Promise.all([
    SellerTxn.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('seller', 'name phone sellerId payout').lean(),
    SellerTxn.countDocuments(filter),
  ]);
  const pendingTotal = (await SellerTxn.aggregate<{ t: number }>([{ $match: { kind: 'withdrawal', status: 'pending' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]))[0]?.t ?? 0;
  ok(res, rows, { ...pageMeta(page, limit, total), pendingTotal });
});

/** Verify a seller withdrawal and either mark it paid (paid by hand) or reject it (returns the balance). */
export const markSellerWithdrawal = asyncHandler(async (req, res) => {
  const { status, reference } = req.body as { status: 'paid' | 'rejected'; reference?: string };
  const txn = await SellerTxn.findOne({ _id: req.params.id, kind: 'withdrawal' });
  if (!txn) throw new ApiError(404, 'Withdrawal not found');
  if (txn.status !== 'pending') throw new ApiError(409, 'This withdrawal was already handled.');
  txn.status = status;
  if (reference) txn.reference = reference;
  await txn.save();
  ok(res, txn);
});

/** Verify a seller withdrawal and pay it out automatically through RazorpayX. */
export const paySellerWithdrawalAdmin = asyncHandler(async (req, res) => {
  const cfg = await razorpayxConfig();
  if (!cfg) throw new ApiError(400, 'RazorpayX payouts are not switched on. Set it up in Integrations, or use “Mark paid” after paying by hand.');
  await paySellerWithdrawal(String(req.params.id));
  const txn = await SellerTxn.findById(req.params.id).lean();
  ok(res, txn);
});

/** Confirm a rider's cash submission: clear the COD they owe and mark it confirmed. */
export const confirmCashSubmit = asyncHandler(async (req, res) => {
  const txn = await WalletTxn.findOne({ _id: req.params.id, kind: 'cash_submit' });
  if (!txn) throw new ApiError(404, 'Cash submission not found');
  if (txn.status !== 'pending') throw new ApiError(409, 'This submission was already handled.');
  txn.status = 'confirmed';
  await txn.save();
  await Order.updateMany(
    { rider: txn.rider, status: 'delivered', paymentMethod: 'cod', codSettled: { $ne: true } },
    { $set: { codSettled: true } },
  );
  await User.updateOne({ _id: txn.rider, riderPaused: true }, { $set: { riderPaused: false, riderPausedAt: null } });
  ok(res, txn);
});

/** Give a rider a bonus or a manual adjustment on their wallet. */
export const adjustRiderWallet = asyncHandler(async (req, res) => {
  const { amount, note } = req.body as { amount: number; note?: string };
  const rider = await User.exists({ _id: req.params.id, role: 'rider' });
  if (!rider) throw new ApiError(404, 'Rider not found');
  const txn = await WalletTxn.create({ rider: req.params.id, kind: 'bonus', amount: Math.round(amount), status: 'completed', note: note || 'Bonus from admin' });
  ok(res, txn, undefined, 201);
});

/* ============ Dashboard bell ============ */

export const listAdminAlerts = asyncHandler(async (_req, res) => {
  const [alerts, unread] = await Promise.all([
    AdminAlert.find().sort({ createdAt: -1 }).limit(30).populate('rider', 'name email').lean(),
    AdminAlert.countDocuments({ read: false }),
  ]);
  ok(res, alerts, { unread });
});

export const readAdminAlerts = asyncHandler(async (_req, res) => {
  await AdminAlert.updateMany({ read: false }, { $set: { read: true } });
  ok(res, { message: 'Marked as read' });
});

/* ============ Orders search by rider ============ */

/** Order ids filter for "search by delivery boy name" on the Orders page. */
export async function riderFilter(name?: string): Promise<FilterQuery<IOrder> | null> {
  if (!name) return null;
  const riders = await User.find({ role: 'rider', name: { $regex: escapeRegex(name), $options: 'i' } }).select('_id').lean();
  return { rider: { $in: riders.map((r) => r._id) } };
}

/* ============ Contact-form submissions ============ */

export const listEnquiries = asyncHandler(async (req, res) => {
  const { kind, page, limit } = req.query as unknown as { kind?: string; page: number; limit: number };
  const filter = kind ? { kind } : {};
  const [rows, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Enquiry.countDocuments(filter),
  ]);
  ok(res, rows, pageMeta(page, limit, total));
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  await Enquiry.deleteOne({ _id: req.params.id });
  ok(res, { deleted: true });
});

/** A long-distance rider is the only one who sees orders beyond the last distance band. */
export const setRiderLongDistance = asyncHandler(async (req, res) => {
  const { longDistance } = req.body as { longDistance: boolean };
  const rider = await User.findOneAndUpdate({ _id: req.params.id, role: 'rider' }, { $set: { riderLongDistance: longDistance } }, { new: true })
    .select('name riderLongDistance')
    .lean();
  if (!rider) throw new ApiError(404, 'Rider not found');
  ok(res, rider);
});

/* ============ Standard categories: home-screen rows pinned to the top or bottom ============ */

export const listStandardCategories = asyncHandler(async (_req, res) => {
  const rows = await StandardCategory.find().sort({ position: 1, sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { standardCategories: { $in: rows.map((r) => r._id) } } },
    { $unwind: '$standardCategories' },
    { $group: { _id: '$standardCategories', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  ok(res, rows.map((r) => ({ ...r, products: byId.get(String(r._id)) ?? 0 })));
});

export const createStandardCategory = asyncHandler(async (req, res) => {
  const row = await StandardCategory.create(req.body);
  clearCatalogCache();
  created(res, row);
});

export const updateStandardCategory = asyncHandler(async (req, res) => {
  const row = await StandardCategory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!row) throw new ApiError(404, 'Standard category not found');
  clearCatalogCache();
  ok(res, row);
});

export const deleteStandardCategory = asyncHandler(async (req, res) => {
  const row = await StandardCategory.findByIdAndDelete(req.params.id);
  if (!row) throw new ApiError(404, 'Standard category not found');
  await Product.updateMany({ standardCategories: row._id }, { $pull: { standardCategories: row._id } });
  clearCatalogCache();
  ok(res, { deleted: true });
});

/* ============ Integrations: Google / Facebook login and Razorpay, set from the admin panel ============ */

/** What the panel shows: ids in full, secrets only as "saved". */
async function integrationsView() {
  const doc = await Integrations.findOne({ key: 'global' }).lean();
  const live = await getIntegrations();
  return {
    googleClientId: doc?.google?.clientId ?? '',
    facebookAppId: doc?.facebook?.appId ?? '',
    facebookSecretSaved: !!doc?.facebook?.appSecretEnc,
    razorpayKeyId: doc?.razorpay?.keyId ?? '',
    razorpaySecretSaved: !!doc?.razorpay?.keySecretEnc,
    razorpayWebhookSaved: !!doc?.razorpay?.webhookSecretEnc,
    razorpayEnabled: doc?.razorpay?.enabled ?? true,
    // Google Maps key (client-side; shown in full so the admin can see/edit it).
    googleMapsApiKey: doc?.maps?.googleApiKey ?? '',
    firebaseWeb: { apiKey: '', authDomain: '', projectId: '', appId: '', messagingSenderId: '', storageBucket: '', vapidKey: '', ...(doc?.firebase?.webConfig ?? {}) },
    firebaseServiceAccountSaved: !!doc?.firebase?.serviceAccountEnc,
    firebaseProjectId: live.firebase.serviceAccount?.project_id ?? '',
    firebaseOtpOnSignup: !!doc?.firebase?.otpOnSignup,
    firebaseOtpOnLogin: !!doc?.firebase?.otpOnLogin,
    firebasePushEnabled: !!doc?.firebase?.pushEnabled,
    shiprocketEmail: doc?.shiprocket?.email ?? '',
    shiprocketPasswordSaved: !!doc?.shiprocket?.passwordEnc,
    shiprocketPickupLocation: doc?.shiprocket?.pickupLocation ?? '',
    shiprocketChannelId: doc?.shiprocket?.channelId ?? '',
    shiprocketEnabled: !!doc?.shiprocket?.enabled,
    razorpayxAccountNumber: doc?.razorpayx?.accountNumber ?? '',
    razorpayxKeyId: doc?.razorpayx?.keyId ?? '',
    razorpayxSecretSaved: !!doc?.razorpayx?.keySecretEnc,
    razorpayxEnabled: !!doc?.razorpayx?.enabled,
    razorpayxAutoPayout: !!doc?.razorpayx?.autoPayout,
    /** Whether each one is actually working for customers right now (the .env file counts too). */
    live: {
      google: !!live.googleClientId,
      facebook: !!(live.facebookAppId && live.facebookAppSecret),
      razorpay: !!(await razorpayKeys()),
      firebaseOtp: !!(live.firebase.webConfig.apiKey && live.firebase.webConfig.projectId),
      firebasePush: !!live.firebase.serviceAccount,
      shiprocket: !!(live.shiprocket.enabled && live.shiprocket.email && live.shiprocket.password),
      razorpayx: !!(live.razorpayx.enabled && live.razorpayx.accountNumber && live.razorpayx.keyId && live.razorpayx.keySecret),
      googleMaps: !!live.googleMapsApiKey,
    },
  };
}

export const getIntegrationsAdmin = asyncHandler(async (_req, res) => {
  ok(res, await integrationsView());
});

export const updateIntegrationsAdmin = asyncHandler(async (req, res) => {
  const b = req.body as {
    googleClientId?: string;
    facebookAppId?: string;
    facebookAppSecret?: string;
    clearFacebookSecret?: boolean;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
    clearRazorpaySecret?: boolean;
    razorpayWebhookSecret?: string;
    clearRazorpayWebhook?: boolean;
    razorpayEnabled?: boolean;
    googleMapsApiKey?: string;
    firebaseWeb?: Record<string, string | undefined>;
    firebaseServiceAccount?: string;
    clearFirebaseServiceAccount?: boolean;
    firebaseOtpOnSignup?: boolean;
    firebaseOtpOnLogin?: boolean;
    firebasePushEnabled?: boolean;
    shiprocketEmail?: string;
    shiprocketPassword?: string;
    clearShiprocketPassword?: boolean;
    shiprocketPickupLocation?: string;
    shiprocketChannelId?: string;
    shiprocketEnabled?: boolean;
    razorpayxAccountNumber?: string;
    razorpayxKeyId?: string;
    razorpayxKeySecret?: string;
    clearRazorpayxSecret?: boolean;
    razorpayxEnabled?: boolean;
    razorpayxAutoPayout?: boolean;
  };
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (b.googleClientId !== undefined) set['google.clientId'] = b.googleClientId;
  if (b.facebookAppId !== undefined) set['facebook.appId'] = b.facebookAppId;
  if (b.facebookAppSecret) set['facebook.appSecretEnc'] = seal(b.facebookAppSecret);
  else if (b.clearFacebookSecret) unset['facebook.appSecretEnc'] = 1;
  if (b.razorpayKeyId !== undefined) {
    b.razorpayKeyId = b.razorpayKeyId.trim();
    const current = await Integrations.findOne({ key: 'global' }).select('razorpay').lean();
    if (b.razorpayKeyId && b.razorpayKeyId !== current?.razorpay?.keyId && !b.razorpayKeySecret?.trim()) {
      throw new ApiError(400, 'When changing the Razorpay Key ID, also enter its matching Key Secret from the same Razorpay account and mode.');
    }
    set['razorpay.keyId'] = b.razorpayKeyId;
  }
  if (b.razorpayKeySecret?.trim()) set['razorpay.keySecretEnc'] = seal(b.razorpayKeySecret.trim());
  else if (b.clearRazorpaySecret) unset['razorpay.keySecretEnc'] = 1;
  if (b.razorpayWebhookSecret?.trim()) set['razorpay.webhookSecretEnc'] = seal(b.razorpayWebhookSecret.trim());
  else if (b.clearRazorpayWebhook) unset['razorpay.webhookSecretEnc'] = 1;
  if (b.razorpayEnabled !== undefined) set['razorpay.enabled'] = b.razorpayEnabled;
  if (b.googleMapsApiKey !== undefined) set['maps.googleApiKey'] = b.googleMapsApiKey.trim();
  for (const [k, v] of Object.entries(b.firebaseWeb ?? {})) if (v !== undefined) set[`firebase.webConfig.${k}`] = v;
  if (b.firebaseServiceAccount) {
    let sa: { client_email?: string; private_key?: string; project_id?: string };
    try {
      sa = JSON.parse(b.firebaseServiceAccount);
    } catch {
      throw new ApiError(400, 'The service account is not valid JSON. Paste the whole file you downloaded from Firebase.');
    }
    if (!sa.client_email || !sa.private_key || !sa.project_id) {
      throw new ApiError(400, 'That JSON is not a Firebase service account (client_email, private_key or project_id is missing).');
    }
    set['firebase.serviceAccountEnc'] = seal(b.firebaseServiceAccount);
    if (!b.firebaseWeb?.projectId) set['firebase.webConfig.projectId'] ??= sa.project_id;
  } else if (b.clearFirebaseServiceAccount) unset['firebase.serviceAccountEnc'] = 1;
  if (b.firebaseOtpOnSignup !== undefined) set['firebase.otpOnSignup'] = b.firebaseOtpOnSignup;
  if (b.firebaseOtpOnLogin !== undefined) set['firebase.otpOnLogin'] = b.firebaseOtpOnLogin;
  if (b.firebasePushEnabled !== undefined) set['firebase.pushEnabled'] = b.firebasePushEnabled;
  if (b.shiprocketEmail !== undefined) set['shiprocket.email'] = b.shiprocketEmail;
  if (b.shiprocketPassword) set['shiprocket.passwordEnc'] = seal(b.shiprocketPassword);
  else if (b.clearShiprocketPassword) unset['shiprocket.passwordEnc'] = 1;
  if (b.shiprocketPickupLocation !== undefined) set['shiprocket.pickupLocation'] = b.shiprocketPickupLocation;
  if (b.shiprocketChannelId !== undefined) set['shiprocket.channelId'] = b.shiprocketChannelId;
  if (b.shiprocketEnabled !== undefined) set['shiprocket.enabled'] = b.shiprocketEnabled;
  if (b.razorpayxAccountNumber !== undefined) set['razorpayx.accountNumber'] = b.razorpayxAccountNumber;
  if (b.razorpayxKeyId !== undefined) set['razorpayx.keyId'] = b.razorpayxKeyId;
  if (b.razorpayxKeySecret) set['razorpayx.keySecretEnc'] = seal(b.razorpayxKeySecret);
  else if (b.clearRazorpayxSecret) unset['razorpayx.keySecretEnc'] = 1;
  if (b.razorpayxEnabled !== undefined) set['razorpayx.enabled'] = b.razorpayxEnabled;
  if (b.razorpayxAutoPayout !== undefined) set['razorpayx.autoPayout'] = b.razorpayxAutoPayout;
  await Integrations.updateOne(
    { key: 'global' },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { upsert: true },
  );
  invalidateIntegrations();
  clearCatalogCache(); // the public settings carry the on/off flags and the public ids
  ok(res, await integrationsView());
});

/** Proves the service account works with Google, then sends a test push to the admin's own devices (if any). */
export const testFirebaseAdmin = asyncHandler(async (req, res) => {
  const projectId = await checkServiceAccount();
  const sent = await pushToUsers([req.user!.id], { title: 'Autozo test', body: 'Push notifications are working.' });
  ok(res, { projectId, sentToYourDevices: sent });
});

/** Checks the saved Razorpay keys against Razorpay itself, so a typo is caught before a customer pays. */
export const testRazorpayAdmin = asyncHandler(async (_req, res) => {
  const keys = await razorpayKeys();
  if (!keys) throw new ApiError(400, 'Save the Razorpay Key ID and Key Secret first.');
  try {
    await testRazorpayKeys(keys);
  } catch (error) {
    if (error instanceof ApiError && (error.details as { code?: string } | undefined)?.code === 'payment_gateway_auth_failed') {
      throw new ApiError(400, 'Razorpay rejected the saved API keys. Save the matching Key ID and Key Secret from the same Razorpay account and mode, then test again.');
    }
    throw error;
  }
  ok(res, { ok: true, message: 'Razorpay accepted these keys.' });
});

/** Logs in to Shiprocket with the saved API credentials and lists the pickup locations found. */
export const testShiprocketAdmin = asyncHandler(async (_req, res) => {
  ok(res, await testShiprocket());
});

/* ============ Gallery and videos ============ */

export const listMediaAdmin = asyncHandler(async (req, res) => {
  const { kind } = req.query as { kind?: 'photo' | 'video' };
  const items = await MediaItem.find(kind ? { kind } : {}).sort({ sortOrder: 1, createdAt: -1 }).lean();
  ok(res, items.map(presentMedia));
});

export const createMedia = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (!body.thumbnail) delete body.thumbnail;
  created(res, presentMedia((await MediaItem.create(body)).toObject()));
});

export const updateMedia = asyncHandler(async (req, res) => {
  const item = await MediaItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
  if (!item) throw new ApiError(404, 'Item not found');
  ok(res, presentMedia(item));
});

export const deleteMedia = asyncHandler(async (req, res) => {
  const item = await MediaItem.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  ok(res, { message: 'Deleted' });
});

/** Public: the Gallery page (kind=photo) and the Videos page (kind=video). */
export const listMediaPublic = (kind: 'photo' | 'video') =>
  asyncHandler(async (_req, res) => {
    const items = await MediaItem.find({ kind, isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).limit(200).lean();
    ok(res, items.map(presentMedia));
  });
