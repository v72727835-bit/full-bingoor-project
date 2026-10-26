import crypto from 'crypto';
import { Types } from 'mongoose';
import { AdminAlert } from '../models/AdminAlert';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Shop } from '../models/Shop';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { importProducts } from '../services/bulkProducts.service';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok, pageMeta } from '../utils/response';
import { assignRiderToOrder, assignToShiprocket, freeRidersForOrder, moveOrderStatus, ridersForOrder, withRiderPool } from '../services/orderFlow.service';
import { ONLINE_WINDOW_MS } from '../services/rider.service';
import { signAccessToken, signRefreshToken, sha256 } from '../utils/jwt';
import { SellerTxn } from '../models/SellerTxn';
import { loadSettings } from '../services/settings.service';
import { sellerMinWithdraw, sellerWalletSummary, syncSellerPayout } from '../services/sellerPay.service';

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ============ Seller login and dashboard ============ */

export const sellerLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body as { identifier: string; password: string };
  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase(), role: 'seller' }
    : { phone: identifier.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''), role: 'seller' };
  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid phone/email or password');
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled. Please contact support.');
  if (user.role !== 'seller') throw new ApiError(403, 'This login is only for sellers.');
  if (user.sellerStatus === 'pending') throw new ApiError(403, 'Your registration is waiting for approval. We will let you in as soon as the Autozo team approves it.');
  if (user.sellerStatus === 'rejected') throw new ApiError(403, `Your registration was not approved${user.sellerRejectReason ? `: ${user.sellerRejectReason}` : '.'} Please contact support.`);
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [{ hash: sha256(refreshToken), createdAt: new Date() }], $slice: -5 } }, $set: { lastLoginAt: new Date() } },
  );
  ok(res, { user, accessToken, refreshToken });
});

async function sellerStats(sellerId: string, ackAt?: Date, warehouses: Types.ObjectId[] = []) {
  const id = new Types.ObjectId(sellerId);
  const live = await Product.countDocuments({ seller: id, isActive: true });
  const total = await Product.countDocuments({ seller: id });
  const rows = await Order.aggregate<{ _id: null; orders: number; revenue: number }>([
    { $match: { sellerIds: id, status: { $nin: ['cancelled', 'rejected'] } } },
    { $unwind: '$items' },
    { $match: { 'items.seller': id } },
    { $group: { _id: null, orderIds: { $addToSet: '$_id' }, revenue: { $sum: '$items.lineTotal' } } },
    { $project: { orders: { $size: '$orderIds' }, revenue: 1 } },
  ]);
  const kind = (await User.findById(id).select('sellerKind').lean())?.sellerKind;
  const unseen = await Order.countDocuments({ ...(kind === 'product' ? { sellerIds: id } : { shop: { $in: warehouses } }), ...(ackAt ? { createdAt: { $gt: ackAt } } : {}) });
  const liveOrders = await Order.countDocuments({ sellerIds: id, status: { $in: ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'] } });
  return { liveListings: live, totalListings: total, liveOrders, orders: rows[0]?.orders ?? 0, revenue: Math.round((rows[0]?.revenue ?? 0) * 100) / 100, unseenOrders: unseen };
}

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id).select('name phone email sellerId sellerProfile sellerAckAt sellerWarehouses sellerKind').populate('sellerWarehouses', 'name').lean();
  if (!user) throw new ApiError(404, 'Seller not found');
  const ids = (user.sellerWarehouses ?? []).map((w) => (w as unknown as { _id: Types.ObjectId })._id);
  ok(res, { user, stats: await sellerStats(req.user!.id, user.sellerAckAt, ids) });
});

/** Closes the "you received N orders" popup: everything up to now counts as seen. */
export const ackOrders = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user!.id }, { $set: { sellerAckAt: new Date() } });
  ok(res, { ok: true });
});

/* ============ One-time registration form ============ */

function newSellerId(): string {
  // 8 characters from an unambiguous alphabet - unique per seller, easy to read aloud.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return 'BS' + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export const saveProfile = asyncHandler(async (req, res) => {
  const body = req.body as {
    firm: string; address: string; mobile: string; aadhaar?: string; pan?: string;
    bankName: string; accountNumber: string; accountType: 'current' | 'savings'; ifsc: string;
  };
  const user = await User.findById(req.user!.id).select('sellerProfile sellerId');
  if (!user) throw new ApiError(404, 'Seller not found');
  if (user.sellerProfile?.locked) {
    throw new ApiError(409, 'Your details are saved and cannot be edited. Contact Autozo support to change them.');
  }
  let sellerId = user.sellerId;
  for (let i = 0; !sellerId && i < 5; i++) {
    const candidate = newSellerId();
    if (!(await User.exists({ sellerId: candidate }))) sellerId = candidate;
  }
  if (!sellerId) throw new ApiError(500, 'Could not create a seller id. Please try again.');
  user.sellerId = sellerId;
  // The account holder name always follows the firm name entered above it.
  user.sellerProfile = { ...body, holderName: body.firm, locked: true, submittedAt: new Date() };
  await user.save();
  ok(res, { sellerId, sellerProfile: user.sellerProfile });
});

/* ============ Listings ============ */

export const listMyProducts = asyncHandler(async (req, res) => {
  const { page, limit, q, status, category } = req.query as unknown as { page: number; limit: number; q?: string; status?: 'live' | 'off' | 'out' | 'low'; category?: string };
  const filter: Record<string, unknown> = await myProductScope(req.user!.id);
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { brand: { $regex: escapeRegex(q), $options: 'i' } }];
  if (category) filter.category = category;
  if (status === 'live') Object.assign(filter, { isActive: true, stock: { $gt: 0 } });
  if (status === 'off') filter.isActive = false;
  if (status === 'out') filter.stock = 0;
  if (status === 'low') Object.assign(filter, { isActive: true, stock: { $gt: 0, $lte: 5 } });
  const [rows, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('category', 'name').populate('shop', 'name').lean(),
    Product.countDocuments(filter),
  ]);
  ok(res, rows, pageMeta(page, limit, total));
});

export const createMyProduct = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user!.id).select('sellerWarehouses').lean();
  if (!me) throw new ApiError(404, 'Account not found');
  const body = req.body as {
    warehouse?: string;
    category: string; name: string; nameHi?: string; brand?: string; description?: string; images: string[];
    price: number; mrp: number; unit: string; stock: number; attributes: string[]; foodType: '' | 'veg' | 'nonveg';
    tags: string[]; variantGroup?: string; variantLabel?: string;
  };
  const category = await Category.findOne({ _id: body.category, level: 3, isActive: true }).select('_id').lean();
  if (!category) throw new ApiError(400, 'Choose the child category your product belongs to.');
  // Sellers cannot set a sort code or points: the admin does. New listings fall in A-Z order.
  const mine = (me.sellerWarehouses ?? []).map(String);
  if (!mine.length) throw new ApiError(409, 'No warehouse is assigned to you yet. Ask Autozo support to assign one.');
  const warehouse = body.warehouse ?? (mine.length === 1 ? mine[0] : undefined);
  if (!warehouse) throw new ApiError(400, 'Choose the warehouse this product is stocked in.');
  if (!mine.includes(warehouse)) throw new ApiError(403, 'That warehouse is not assigned to you.');
  const { warehouse: _w, ...rest } = body;
  const product = await Product.create({ ...rest, shop: warehouse, seller: req.user!.id, isActive: true });
  created(res, product);
});

/** Many listings in one go; every row is checked on its own and reported back. */
export const bulkCreateMyProducts = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user!.id).select('sellerWarehouses').lean();
  if (!me) throw new ApiError(404, 'Account not found');
  const shopIds = (me.sellerWarehouses ?? []).map(String);
  if (!shopIds.length) throw new ApiError(409, 'No warehouse is assigned to you yet. Ask Autozo support to assign one.');
  const { rows, dryRun } = req.body as { rows: Record<string, unknown>[]; dryRun?: boolean };
  ok(res, await importProducts(rows, { mode: 'seller', sellerId: req.user!.id, shopIds, dryRun }));
});

/** Edit a listing: price, stock, text, photos, category, taking it off the shelf. */
export const updateMyProduct = asyncHandler(async (req, res) => {
  const patch = req.body as Record<string, unknown>;
  if (patch.category) {
    const category = await Category.findOne({ _id: patch.category, level: 3, isActive: true }).select('_id').lean();
    if (!category) throw new ApiError(400, 'Choose the child category your product belongs to.');
  }
  const product = await Product.findOneAndUpdate({ _id: req.params.id, ...(await myProductScope(req.user!.id)) }, { $set: patch }, { new: true, runValidators: true }).lean();
  if (!product) throw new ApiError(404, 'Listing not found or access denied');
  ok(res, product);
});

export const deleteMyProduct = asyncHandler(async (req, res) => {
  const r = await Product.deleteOne({ _id: req.params.id, ...(await myProductScope(req.user!.id)) });
  if (!r.deletedCount) throw new ApiError(404, 'Listing not found');
  ok(res, { deleted: true });
});

/* ============ Orders of the seller's warehouses ============ */

async function myWarehouses(userId: string): Promise<Types.ObjectId[]> {
  const me = await User.findById(userId).select('sellerWarehouses').lean();
  return me?.sellerWarehouses ?? [];
}

/** Which products this seller may see and edit: a warehouse sees its whole shelf, a product seller only their own listings. */
async function myProductScope(userId: string): Promise<Record<string, unknown>> {
  const me = await User.findById(userId).select('sellerWarehouses sellerKind').lean();
  const shop = { $in: me?.sellerWarehouses ?? [] };
  return me?.sellerKind === 'product' ? { shop, seller: new Types.ObjectId(userId) } : { shop };
}

/** Product sellers (#45) do not pack, dispatch or see customers - these routes are for warehouses only. */
export const warehouseOnly = asyncHandler(async (req, _res, next) => {
  const me = await User.findById(req.user!.id).select('sellerKind').lean();
  if (me?.sellerKind === 'product') throw new ApiError(403, 'This is only for warehouse logins.');
  next();
});

/**
 * A product seller's orders: only the lines they listed, with product name,
 * quantity and payment. No customer name, phone, address or rider.
 */
async function listProductSellerOrders(userId: string, page: number, limit: number, status?: string, q?: string) {
  const id = new Types.ObjectId(userId);
  const filter: Record<string, unknown> = { sellerIds: id };
  if (status) filter.status = status;
  if (q) filter.orderNumber = { $regex: escapeRegex(q), $options: 'i' };
  const [rows, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('orderNumber status paymentMethod paymentStatus items createdAt').lean(),
    Order.countDocuments(filter),
  ]);
  const orders = rows.map((o) => {
    const items = (o.items ?? [])
      .filter((i) => String(i.seller) === userId)
      .map((i) => ({ name: i.name, unit: i.unit, quantity: i.quantity, price: i.price, lineTotal: i.lineTotal }));
    return {
      _id: o._id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      createdAt: (o as { createdAt?: Date }).createdAt,
      items,
      amount: Math.round(items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0) * 100) / 100,
    };
  });
  return { orders, total };
}

async function assertMyOrder(userId: string, orderId: string) {
  const order = await Order.exists({ _id: orderId, shop: { $in: await myWarehouses(userId) } });
  if (!order) throw new ApiError(404, 'Order not found');
}

export const listMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, status, q } = req.query as unknown as { page: number; limit: number; status?: string; q?: string };
  const me = await User.findById(req.user!.id).select('sellerKind').lean();
  if (me?.sellerKind === 'product') {
    const { orders, total } = await listProductSellerOrders(req.user!.id, page, limit, status, q);
    return ok(res, orders, pageMeta(page, limit, total));
  }
  const filter: Record<string, unknown> = { shop: { $in: await myWarehouses(req.user!.id) } };
  if (status) filter.status = status;
  if (q) filter.orderNumber = { $regex: escapeRegex(q), $options: 'i' };
  const [rows, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('-statusHistory -deliveryOtp').populate('user', 'name phone').populate('shop', 'name').populate('rider', 'name phone').lean(),
    Order.countDocuments(filter),
  ]);
  ok(res, await withRiderPool(rows), pageMeta(page, limit, total));
});

export const setMyOrderStatus = asyncHandler(async (req, res) => {
  await assertMyOrder(req.user!.id, String(req.params.id));
  const { status, note } = req.body as { status: 'accepted' | 'rejected' | 'preparing' | 'ready_for_pickup' | 'cancelled'; note?: string };
  ok(res, await moveOrderStatus(String(req.params.id), status, note, 'shop'));
});

export const myOrderFreeRiders = asyncHandler(async (req, res) => {
  await assertMyOrder(req.user!.id, String(req.params.id));
  ok(res, await freeRidersForOrder(String(req.params.id)));
});

export const myOrderRiders = asyncHandler(async (req, res) => {
  await assertMyOrder(req.user!.id, String(req.params.id));
  ok(res, await ridersForOrder(String(req.params.id)));
});

export const assignRiderMyOrder = asyncHandler(async (req, res) => {
  await assertMyOrder(req.user!.id, String(req.params.id));
  ok(res, await assignRiderToOrder(String(req.params.id), req.body.rider, 'seller'));
});

export const assignShiprocketMyOrder = asyncHandler(async (req, res) => {
  await assertMyOrder(req.user!.id, String(req.params.id));
  ok(res, await assignToShiprocket(String(req.params.id), 'seller'));
});

/* ============ Seller earnings wallet ============ */

/** Top of the earnings screen: gross sales, commission, net balance and the saved payout account. */
export const getMyWallet = asyncHandler(async (req, res) => {
  const id = req.user!.id;
  // Refresh any in-flight payout so the balance is current.
  const inflight = await SellerTxn.findOne({ seller: id, kind: 'withdrawal', status: 'pending', payoutId: { $exists: true } }).select('_id').lean();
  if (inflight) await syncSellerPayout(inflight._id).catch(() => undefined);
  const { settings } = await loadSettings();
  const [sum, me] = await Promise.all([sellerWalletSummary(id), User.findById(id).select('payout').lean()]);
  ok(res, { ...sum, minWithdraw: sellerMinWithdraw(settings), commissionPct: settings.sellerPay?.commissionPct ?? 10, account: me?.payout ?? null });
});

/** The seller's earnings passbook. */
export const listMyWalletTxns = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = { seller: req.user!.id };
  if (typeof req.query.kind === 'string') filter.kind = req.query.kind;
  const [rows, total] = await Promise.all([
    SellerTxn.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SellerTxn.countDocuments(filter),
  ]);
  ok(res, rows, pageMeta(page, limit, total));
});

/** Save or update where the seller gets paid (shared with the user's payout fields). */
export const saveMyAccount = asyncHandler(async (req, res) => {
  const { upi, bankHolder, bankNumber, bankIfsc } = req.body as { upi?: string; bankHolder?: string; bankNumber?: string; bankIfsc?: string };
  if (!upi && !(bankHolder && bankNumber && bankIfsc)) throw new ApiError(400, 'Add a UPI id, or the full bank account (holder name, number and IFSC).');
  const payout = { upi: upi || undefined, bankHolder: bankHolder || undefined, bankNumber: bankNumber || undefined, bankIfsc: bankIfsc || undefined };
  await User.updateOne({ _id: req.user!.id }, { $set: { payout } });
  ok(res, payout);
});

/** The seller asks to withdraw part of their balance; the super admin verifies and pays it. */
export const requestMyWithdraw = asyncHandler(async (req, res) => {
  const { amount, method } = req.body as { amount: number; method: 'upi' | 'bank' };
  const { settings } = await loadSettings();
  const me = await User.findById(req.user!.id).select('payout').lean();
  const payout = me?.payout;
  const destination = method === 'upi' ? payout?.upi : payout?.bankNumber ? `${payout.bankHolder ?? ''} · ${payout.bankNumber} · ${payout.bankIfsc ?? ''}` : undefined;
  if (!destination) throw new ApiError(400, method === 'upi' ? 'Add your UPI id first.' : 'Add your bank account first.');
  const open = await SellerTxn.exists({ seller: req.user!.id, kind: 'withdrawal', status: 'pending' });
  if (open) throw new ApiError(409, 'You already have a withdrawal waiting for approval.');
  const min = sellerMinWithdraw(settings);
  const sum = await sellerWalletSummary(req.user!.id);
  if (amount < min) throw new ApiError(400, `The smallest withdrawal is ₹${min}.`);
  if (amount > sum.balance) throw new ApiError(400, `You can withdraw up to ₹${Math.floor(sum.balance)}.`);
  const txn = await SellerTxn.create({ seller: req.user!.id, kind: 'withdrawal', amount: Math.round(amount), status: 'pending', method, destination, note: 'Withdrawal request' });
  ok(res, txn, undefined, 201);
});

/** The category tree the seller picks from: main → sub → child. */
export const categoryTree = asyncHandler(async (_req, res) => {
  const all = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('name nameHi parent level').lean();
  ok(res, all);
});

/* ============ Admin: seller accounts ============ */

export const adminCreateSeller = asyncHandler(async (req, res) => {
  const { name, phone, email, password, warehouses, kind } = req.body as { name: string; phone: string; email?: string; password: string; warehouses: string[]; kind: 'warehouse' | 'product' };
  const found = await Shop.countDocuments({ _id: { $in: warehouses } });
  if (found !== new Set(warehouses).size) throw new ApiError(400, 'Warehouse not found');
  const clash = await User.findOne({ role: 'seller', $or: [{ phone }, ...(email ? [{ email }] : [])] }).select('phone');
  if (clash) throw new ApiError(409, 'That phone or email is already registered');
  const user = await User.create({ name, phone, email, password, role: 'seller', sellerWarehouses: warehouses, ...(kind === 'product' ? { sellerKind: 'product' } : {}) });
  created(res, { _id: user._id, name: user.name, phone: user.phone, email: user.email, sellerId: user.sellerId, sellerKind: user.sellerKind });
});

export const adminListSellers = asyncHandler(async (req, res) => {
  const { page, limit, q, kind } = req.query as unknown as { page: number; limit: number; q?: string; kind?: 'warehouse' | 'product' };
  const filter: Record<string, unknown> = { role: 'seller' };
  if (kind === 'product') filter.sellerKind = 'product';
  else if (kind === 'warehouse') filter.sellerKind = { $ne: 'product' };
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { phone: { $regex: escapeRegex(q) } }, { sellerId: { $regex: escapeRegex(q), $options: 'i' } }];
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('name phone email isActive sellerId sellerProfile sellerWarehouses sellerKind createdAt').populate('sellerWarehouses', 'name').lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Product.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { seller: { $in: rows.map((r) => r._id) } } },
    { $group: { _id: '$seller', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  ok(res, rows.map((r) => ({ ...r, listings: byId.get(String(r._id)) ?? 0 })), pageMeta(page, limit, total));
});

/** Clears the seller's saved form in one go, so they can fill it again. */
export const adminClearSellerProfile = asyncHandler(async (req, res) => {
  const r = await User.updateOne({ _id: req.params.id, role: 'seller' }, { $unset: { sellerProfile: 1 } });
  if (!r.matchedCount) throw new ApiError(404, 'Seller not found');
  ok(res, { cleared: true });
});

export const adminSetSellerActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body as { isActive: boolean };
  const r = await User.updateOne({ _id: req.params.id, role: 'seller' }, { $set: { isActive } });
  if (!r.matchedCount) throw new ApiError(404, 'Seller not found');
  ok(res, { isActive });
});

export const adminSetSellerWarehouses = asyncHandler(async (req, res) => {
  const { warehouses } = req.body as { warehouses: string[] };
  const found = await Shop.countDocuments({ _id: { $in: warehouses } });
  if (found !== new Set(warehouses).size) throw new ApiError(400, 'Warehouse not found');
  const r = await User.updateOne({ _id: req.params.id, role: 'seller' }, { $set: { sellerWarehouses: warehouses } });
  if (!r.matchedCount) throw new ApiError(404, 'Seller not found');
  ok(res, { warehouses });
});

/* ============ The warehouse's own riders ============ */

export const listMyRiders = asyncHandler(async (req, res) => {
  const warehouses = await myWarehouses(req.user!.id);
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [riders, busy] = await Promise.all([
    User.find({ role: 'rider', $or: [{ warehouse: { $in: warehouses } }, { warehouses: { $in: warehouses } }] }).select('name phone isActive lastSeenAt riderPaused riderCancelCount warehouse warehouses').populate('warehouse', 'name').populate('warehouses', 'name').sort({ name: 1 }).lean(),
    Order.distinct('rider', { status: 'out_for_delivery', rider: { $exists: true } }),
  ]);
  const busyIds = new Set(busy.map(String));
  ok(res, riders.map((r) => ({ ...r, online: !!r.lastSeenAt && r.lastSeenAt >= since, busy: busyIds.has(String(r._id)), paused: !!r.riderPaused })));
});

export const createMyRider = asyncHandler(async (req, res) => {
  const { name, phone, password, warehouse, warehouses } = req.body as { name: string; phone: string; password: string; warehouse?: string; warehouses?: string[] };
  const mine = (await myWarehouses(req.user!.id)).map(String);
  const chosen = [...new Set(warehouses?.length ? warehouses : warehouse ? [warehouse] : mine.length === 1 ? mine : [])];
  if (!chosen.length) throw new ApiError(400, 'Choose the warehouse for this rider.');
  if (chosen.some((w) => !mine.includes(w))) throw new ApiError(403, 'That warehouse is not yours.');
  if (await User.exists({ phone, role: 'rider' })) throw new ApiError(409, 'A rider with this phone number already exists.');
  const rider = await User.create({ name, phone, password, role: 'rider', warehouse: chosen[0], warehouses: chosen, isActive: true });
  created(res, { _id: rider._id, name: rider.name, phone: rider.phone });
});

/* ============ Admin: the login of each warehouse ============ */

export const adminListWarehouseLogins = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'seller', sellerKind: { $ne: 'product' }, sellerWarehouses: { $exists: true, $ne: [] } }).select('name phone isActive sellerWarehouses').lean();
  ok(res, users.flatMap((u) => (u.sellerWarehouses ?? []).map((w) => ({ shop: String(w), _id: u._id, name: u.name, phone: u.phone, isActive: u.isActive }))));
});

/** Creates the warehouse's panel login, or changes its phone / password / on-off. */
export const adminSetWarehouseLogin = asyncHandler(async (req, res) => {
  const { name, phone, password, isActive } = req.body as { name?: string; phone: string; password?: string; isActive?: boolean };
  const shop = await Shop.findById(req.params.id).select('name').lean();
  if (!shop) throw new ApiError(404, 'Warehouse not found');
  const existing = await User.findOne({ role: 'seller', sellerKind: { $ne: 'product' }, sellerWarehouses: shop._id }).select('+password');
  const clash = await User.findOne({ phone, role: 'seller', ...(existing ? { _id: { $ne: existing._id } } : {}) }).select('_id').lean();
  if (clash) throw new ApiError(409, 'That phone is already used by another account');
  if (!existing) {
    if (!password) throw new ApiError(400, 'Set a password for the new login');
    const u = await User.create({ name: name ?? shop.name, phone, password, role: 'seller', sellerWarehouses: [shop._id] });
    return created(res, { _id: u._id, phone: u.phone });
  }
  existing.phone = phone;
  if (name) existing.name = name;
  if (password) existing.password = password;
  if (isActive !== undefined) existing.isActive = isActive;
  existing.refreshTokens = [];
  await existing.save();
  ok(res, { _id: existing._id, phone: existing.phone });
});

/* ============ Warehouses registering themselves ============ */

export const registerWarehouse = asyncHandler(async (req, res) => {
  const b = req.body as {
    name: string; phone: string; email?: string; password: string; shopName: string;
    line1: string; city: string; state: string; pincode: string; location: { lat: number; lng: number }; gst?: string; note?: string;
  };
  const clash = await User.findOne({ role: 'seller', $or: [{ phone: b.phone }, ...(b.email ? [{ email: b.email }] : [])] }).select('_id').lean();
  if (clash) throw new ApiError(409, 'That phone or email is already registered');
  const user = await User.create({
    name: b.name, phone: b.phone, email: b.email, password: b.password, role: 'seller', sellerStatus: 'pending',
    warehouseApplication: {
      shopName: b.shopName, line1: b.line1, city: b.city, state: b.state, pincode: b.pincode,
      lat: b.location.lat, lng: b.location.lng, gst: b.gst, note: b.note, submittedAt: new Date(),
    },
  });
  await AdminAlert.create({ type: 'warehouse_registered', message: `New warehouse "${b.shopName}" (${b.city}) registered and is waiting for approval`, user: user._id });
  created(res, { message: 'Registration received. You can log in once the Autozo team approves it.' });
});

export const adminListWarehouseApplications = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
  const filter = { sellerStatus: status ?? { $in: ['pending', 'approved', 'rejected'] } };
  const [rows, total, pending] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('name phone email sellerStatus sellerRejectReason warehouseApplication sellerWarehouses createdAt').lean(),
    User.countDocuments(filter),
    User.countDocuments({ sellerStatus: 'pending' }),
  ]);
  ok(res, rows, { ...pageMeta(page, limit, total), pending });
});

export const adminApproveWarehouse = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'seller', sellerStatus: { $in: ['pending', 'rejected'] } });
  const app = user?.warehouseApplication;
  if (!user || !app) throw new ApiError(404, 'Registration not found');
  const shop = await Shop.create({
    name: app.shopName,
    owner: user._id,
    phone: user.phone,
    address: { line1: app.line1, city: app.city, state: app.state, pincode: app.pincode },
    location: { type: 'Point', coordinates: [app.lng, app.lat] },
  });
  user.sellerWarehouses = [shop._id as Types.ObjectId];
  user.sellerStatus = 'approved';
  user.sellerRejectReason = undefined;
  await user.save();
  await AdminAlert.updateMany({ type: 'warehouse_registered', user: user._id }, { $set: { read: true } });
  ok(res, { approved: true, shop: shop._id });
});

export const adminRejectWarehouse = asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason: string };
  const r = await User.updateOne({ _id: req.params.id, role: 'seller', sellerStatus: 'pending' }, { $set: { sellerStatus: 'rejected', sellerRejectReason: reason } });
  if (!r.matchedCount) throw new ApiError(404, 'Pending registration not found');
  await AdminAlert.updateMany({ type: 'warehouse_registered', user: req.params.id }, { $set: { read: true } });
  ok(res, { rejected: true });
});

/* ============ Warehouse panel: dashboard, store, customers ============ */

const DAY = 24 * 60 * 60 * 1000;
const LOW_STOCK = 5;

export const warehouseDashboard = asyncHandler(async (req, res) => {
  const shops = await myWarehouses(req.user!.id);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfToday.getTime() - 6 * DAY);
  const live = { $nin: ['cancelled', 'rejected'] };
  const [byStatus, today, week, topProducts, lowStock, outOfStock, products, recent] = await Promise.all([
    Order.aggregate<{ _id: string; n: number }>([{ $match: { shop: { $in: shops } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.aggregate<{ orders: number; revenue: number }>([
      { $match: { shop: { $in: shops }, createdAt: { $gte: startOfToday }, status: live } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
    Order.aggregate<{ _id: string; orders: number; revenue: number }>([
      { $match: { shop: { $in: shops }, createdAt: { $gte: weekAgo }, status: live } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
    Order.aggregate<{ _id: string; name: string; qty: number; revenue: number }>([
      { $match: { shop: { $in: shops }, status: live } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
    Product.find({ shop: { $in: shops }, isActive: true, stock: { $gt: 0, $lte: LOW_STOCK } }).sort({ stock: 1 }).limit(8).select('name stock unit images').lean(),
    Product.countDocuments({ shop: { $in: shops }, stock: 0 }),
    Product.aggregate<{ _id: boolean; n: number }>([{ $match: { shop: { $in: shops } } }, { $group: { _id: '$isActive', n: { $sum: 1 } } }]),
    Order.find({ shop: { $in: shops } }).sort({ createdAt: -1 }).limit(6).select('orderNumber status total createdAt paymentMethod').lean(),
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((r) => [r._id, r.n]));
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * DAY);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = week.find((w) => w._id === key);
    return { date: key, orders: row?.orders ?? 0, revenue: Math.round((row?.revenue ?? 0) * 100) / 100 };
  });
  const revenueTotal = await Order.aggregate<{ revenue: number }>([
    { $match: { shop: { $in: shops }, status: 'delivered' } },
    { $group: { _id: null, revenue: { $sum: '$total' } } },
  ]);
  ok(res, {
    orders: { byStatus: statusCounts, total: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
    today: { orders: today[0]?.orders ?? 0, revenue: Math.round((today[0]?.revenue ?? 0) * 100) / 100 },
    deliveredRevenue: Math.round((revenueTotal[0]?.revenue ?? 0) * 100) / 100,
    trend,
    topProducts,
    lowStock,
    outOfStock,
    products: { live: products.find((p) => p._id === true)?.n ?? 0, off: products.find((p) => p._id === false)?.n ?? 0 },
    recent,
  });
});

export const listMyShops = asyncHandler(async (req, res) => {
  ok(res, await Shop.find({ _id: { $in: await myWarehouses(req.user!.id) } }).select('name description phone logo banner address location isOpen isActive deliveryRadiusKm minOrderAmount deliveryFee gstin').lean());
});

export const updateMyShop = asyncHandler(async (req, res) => {
  if (!(await myWarehouses(req.user!.id)).map(String).includes(String(req.params.id))) throw new ApiError(403, 'That warehouse is not yours.');
  const { location, address, ...rest } = req.body as { location?: { lat: number; lng: number }; address?: Record<string, string>; [k: string]: unknown };
  const set: Record<string, unknown> = { ...rest };
  if (location) set.location = { type: 'Point', coordinates: [location.lng, location.lat] };
  if (address) for (const [k, v] of Object.entries(address)) set[`address.${k}`] = v;
  const shop = await Shop.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true }).lean();
  if (!shop) throw new ApiError(404, 'Warehouse not found');
  ok(res, shop);
});

export const listMyCustomers = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query as unknown as { page: number; limit: number; q?: string };
  const shops = await myWarehouses(req.user!.id);
  const rows = await Order.aggregate<{ _id: Types.ObjectId; orders: number; spent: number; last: Date; name: string; phone: string }>([
    { $match: { shop: { $in: shops }, status: { $nin: ['cancelled', 'rejected'] } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' }, last: { $first: '$createdAt' }, name: { $first: '$address.name' }, phone: { $first: '$address.phone' } } },
    ...(q ? [{ $match: { $or: [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { phone: { $regex: escapeRegex(q) } }] } }] : []),
    { $sort: { last: -1 } },
    { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);
  const total = rows[0] ? ((rows[0] as unknown as { total: { n: number }[] }).total[0]?.n ?? 0) : 0;
  ok(res, (rows[0] as unknown as { rows: unknown[] })?.rows ?? [], pageMeta(page, limit, total));
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const user = await User.findById(req.user!.id).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();
  ok(res, { message: 'Password changed.' });
});
