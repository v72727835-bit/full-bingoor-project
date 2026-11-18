import { assignRiderToOrder, assignToShiprocket, freeRidersForOrder, moveOrderStatus, withRiderPool } from '../services/orderFlow.service';
import { FilterQuery, Types } from 'mongoose';
import { Banner, IBanner } from '../models/Banner';
import { riderFilter } from './adminExtra.controller';
import { codSummary } from '../services/rider.service';
import { Cart } from '../models/Cart';
import { Category, ICategory } from '../models/Category';
import { Coupon, ICoupon } from '../models/Coupon';
import { IOrder, Order } from '../models/Order';
import { IProduct, Product } from '../models/Product';
import { Shop } from '../models/Shop';
import { IUser, User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { importProducts } from '../services/bulkProducts.service';
import { refundRazorpayPayment } from '../services/razorpay.service';
import { asyncHandler } from '../utils/asyncHandler';
import { escapeRegex } from '../utils/helpers';
import { sha256, signAccessToken, signRefreshToken } from '../utils/jwt';
import { created, ok, pageMeta } from '../utils/response';

const MAX_SESSIONS = 5;

/* ============ Auth ============ */

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body as { identifier: string; password: string };

  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase(), role: 'admin' }
    : { phone: identifier.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''), role: 'admin' };

  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email/phone or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled.');
  if (user.role !== 'admin') throw new ApiError(403, 'This login is for admins only.');

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);
  await User.updateOne(
    { _id: user._id },
    {
      $push: { refreshTokens: { $each: [{ hash: sha256(refreshToken), createdAt: new Date() }], $slice: -MAX_SESSIONS } },
      $set: { lastLoginAt: new Date() },
    },
  );
  ok(res, { user, accessToken, refreshToken });
});

/* ============ Dashboard ============ */

/** yyyy-mm-dd in IST, so "today" on the dashboard matches the shop's day. */
const IST_OFFSET_MIN = 330;
function istDayKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

export const stats = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number((req.query as { days?: string }).days) || 14, 7), 90);
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const todayKey = istDayKey(new Date());

  const [
    productCount,
    activeProductCount,
    lowStockCount,
    categoryCount,
    shopCount,
    orderCount,
    statusAgg,
    revenueAgg,
    recentOrders,
    roleAgg,
    trendAgg,
    topProducts,
    lowStockList,
    recentCustomers,
    todayAgg,
  ] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
    Category.countDocuments({}),
    Shop.countDocuments({}),
    Order.countDocuments({}),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: 'delivered' } }, { $group: { _id: null, revenue: { $sum: '$total' } } }]),
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select('orderNumber status total createdAt user shop')
      .populate('user', 'name phone')
      .populate('shop', 'name')
      .lean(),
    User.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $group: { _id: { role: '$role', active: '$isActive' }, count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'rejected']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Product.find({ isActive: true, soldCount: { $gt: 0 } })
      .sort({ soldCount: -1 })
      .limit(6)
      .select('name soldCount price stock images icon unit')
      .lean(),
    Product.find({ isActive: true, stock: { $lte: 5 } })
      .sort({ stock: 1 })
      .limit(6)
      .select('name stock unit images icon shop')
      .populate('shop', 'name')
      .lean(),
    User.find({ role: 'customer' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name phone createdAt lastLoginAt')
      .lean(),
    Order.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 2 * 86_400_000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of statusAgg as { _id: string; count: number }[]) statusCounts[s._id] = s.count;

  // users by role, with an "active" split so the sidebar can show live rider counts
  const usersByRole: Record<string, { total: number; active: number }> = {};
  for (const r of roleAgg as { _id: { role: string; active: boolean }; count: number }[]) {
    const bucket = (usersByRole[r._id.role] ??= { total: 0, active: 0 });
    bucket.total += r.count;
    if (r._id.active) bucket.active += r.count;
  }

  // dense day series (zero-filled) so charts never show gaps
  const byDay = new Map(
    (trendAgg as { _id: string; orders: number; revenue: number; delivered: number; cancelled: number }[]).map((d) => [
      d._id,
      d,
    ]),
  );
  const trend: { date: string; orders: number; revenue: number; delivered: number; cancelled: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = istDayKey(new Date(Date.now() - i * 86_400_000));
    const hit = byDay.get(key);
    trend.push({
      date: key,
      orders: hit?.orders ?? 0,
      revenue: hit?.revenue ?? 0,
      delivered: hit?.delivered ?? 0,
      cancelled: hit?.cancelled ?? 0,
    });
  }

  const todayMap = new Map(
    (todayAgg as { _id: string; orders: number; revenue: number }[]).map((d) => [d._id, d]),
  );
  const yKey = istDayKey(new Date(Date.now() - 86_400_000));
  const today = todayMap.get(todayKey) ?? { orders: 0, revenue: 0 };
  const yesterday = todayMap.get(yKey) ?? { orders: 0, revenue: 0 };

  ok(res, {
    products: { total: productCount, active: activeProductCount, lowStock: lowStockCount },
    categories: categoryCount,
    shops: shopCount,
    customers: usersByRole.customer?.total ?? 0,
    usersByRole,
    orders: { total: orderCount, byStatus: statusCounts },
    revenue: (revenueAgg[0] as { revenue: number } | undefined)?.revenue ?? 0,
    today: { orders: today.orders, revenue: today.revenue },
    yesterday: { orders: yesterday.orders, revenue: yesterday.revenue },
    trend,
    topProducts,
    lowStockList,
    recentCustomers,
    recentOrders,
  });
});

/* ============ Products ============ */

// The edit form opens from these rows, so every field it shows must be here:
// without description / video / cartFeatured / standardCategories the form
// opened blank and saving it wiped them.
const ADMIN_PRODUCT_FIELDS =
  'name slug brand description video images icon price mrp unit stock attributes foodType hsn gstRate paymentMode tags isActive rating ratingCount soldCount nameHi points sortCode ratingLabel variantGroup variantLabel cartFeatured dealOfDay standardCategories seller shop category createdAt';

export const listProductsAdmin = asyncHandler(async (req, res) => {
  const { q, category, shop, isActive, variantGroup, page, limit } = req.query as unknown as {
    q?: string;
    category?: string;
    shop?: string;
    isActive?: boolean;
    variantGroup?: string;
    page: number;
    limit: number;
  };

  const filter: FilterQuery<IProduct> = {};
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { brand: rx }];
  }
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive;
  if (variantGroup) filter.variantGroup = variantGroup;

  const allProducts = await Product.find(filter)
      .sort({ createdAt: -1 })
      .select(ADMIN_PRODUCT_FIELDS)
      .populate('shop', 'name')
      .populate('category', 'name')
      .populate('seller', 'name sellerId sellerProfile.firm')
      .lean();
  const keyFor = (p: (typeof allProducts)[number]) => JSON.stringify([
    p.name.trim().toLowerCase(), p.brand?.trim().toLowerCase() ?? '', String(p.category?._id ?? p.category),
    p.description ?? '', p.images?.[0] ?? '', p.price, p.mrp, p.unit, p.foodType, p.variantGroup ?? '', p.variantLabel ?? '',
    p.nameHi ?? '', p.hsn ?? '', p.gstRate ?? null, p.paymentMode ?? 'both', p.isActive, p.rating, p.ratingCount ?? 0,
    p.ratingLabel ?? '', p.points ?? 0, p.sortCode ?? 1_000_000, !!p.cartFeatured, !!p.dealOfDay,
    JSON.stringify(p.attributes ?? []), JSON.stringify(p.tags ?? []), JSON.stringify(p.standardCategories ?? []),
  ]);
  const groups = new Map<string, Array<(typeof allProducts)[number]>>();
  for (const product of allProducts) {
    const key = keyFor(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  const grouped = [...groups.values()].map((items) => {
    const matchingShopIds = new Set(items.map((p) => String(p.shop?._id ?? p.shop)));
    const selected = shop ? items.filter((p) => String(p.shop?._id ?? p.shop) === shop) : items;
    const representative = selected[0] ?? items[0];
    return {
      ...representative,
      _id: String(representative._id),
      shops: items.map((p) => p.shop),
      productIds: items.map((p) => String(p._id)),
      warehouseCount: matchingShopIds.size,
    };
  }).filter((p) => !shop || String(p.shop?._id ?? p.shop) === shop);
  const products = grouped.slice((page - 1) * limit, page * limit);
  ok(res, products, pageMeta(page, limit, grouped.length));
});

export const getProductAdmin = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('shop', 'name').populate('category', 'name level').lean();
  if (!product) throw new ApiError(404, 'Product not found');
  ok(res, product);
});

async function assertLeafCategory(id: string) {
  const category = await Category.findById(id).select('level').lean();
  if (!category) throw new ApiError(400, 'Category not found');
  if (category.level !== 3) throw new ApiError(400, 'Products must be filed under a level-3 (child) category');
}

export const createProduct = asyncHandler(async (req, res) => {
  await assertLeafCategory(req.body.category);
  const { shop, allWarehouses, ...rest } = req.body as { shop?: string; allWarehouses?: boolean } & Record<string, unknown>;

  // The super admin can stock a product in every warehouse at once: one separate
  // listing per warehouse (each has its own stock), so it reaches every customer.
  if (allWarehouses) {
    const shops = await Shop.find({ isActive: true }).select('_id').lean();
    if (!shops.length) throw new ApiError(400, 'No warehouse exists yet. Create a warehouse first.');
    // Sequential so each listing gets its own unique slug.
    const products = [];
    for (const s of shops) products.push(await Product.create({ ...rest, shop: s._id }));
    return created(res, { count: products.length, products });
  }

  if (!shop) throw new ApiError(400, 'Choose a warehouse, or tick "All warehouses".');
  const one = await Shop.findById(shop).select('_id').lean();
  if (!one) throw new ApiError(400, 'Shop not found');
  const product = await Product.create({ ...rest, shop });
  created(res, product);
});

/** Many products in one go; each row is checked on its own and reported back. */
export const bulkCreateProducts = asyncHandler(async (req, res) => {
  const { rows, dryRun } = req.body as { rows: Record<string, unknown>[]; dryRun?: boolean };
  ok(res, await importProducts(rows, { mode: 'admin', dryRun }));
});

export const updateProduct = asyncHandler(async (req, res) => {
  if (req.body.category) await assertLeafCategory(req.body.category);
  if (req.body.shop) {
    const shop = await Shop.findById(req.body.shop).select('_id').lean();
    if (!shop) throw new ApiError(400, 'Shop not found');
  }
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) throw new ApiError(404, 'Product not found');
  ok(res, product);
});

export const updateProductGroup = asyncHandler(async (req, res) => {
  const { ids, patch } = req.body as { ids: string[]; patch: Record<string, unknown> };
  if (patch.category) await assertLeafCategory(String(patch.category));
  const uniqueIds = [...new Set(ids)];
  const products = await Product.find({ _id: { $in: uniqueIds } }).select('_id').lean();
  if (products.length !== uniqueIds.length) throw new ApiError(404, 'One or more products were not found');
  await Product.updateMany({ _id: { $in: uniqueIds } }, { $set: patch }, { runValidators: true });
  ok(res, { updated: products.length });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  ok(res, { message: 'Product deleted' });
});

export const deleteProductGroup = asyncHandler(async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  const uniqueIds = [...new Set(ids)];
  const existing = await Product.countDocuments({ _id: { $in: uniqueIds } });
  if (existing !== uniqueIds.length) throw new ApiError(404, 'One or more products were not found');
  const result = await Product.deleteMany({ _id: { $in: uniqueIds } });
  ok(res, { message: 'Products deleted', deletedCount: result.deletedCount });
});

/* ============ Categories ============ */

export const listCategoriesAdmin = asyncHandler(async (_req, res) => {
  const all = await Category.find({}).sort({ level: 1, sortOrder: 1, name: 1 }).lean();
  ok(res, all);
});

export const createCategory = asyncHandler(async (req, res) => {
  const { parent, level } = req.body as { parent: string | null; level: number };

  if (parent) {
    const p = await Category.findById(parent).select('level').lean();
    if (!p) throw new ApiError(400, 'Parent category not found');
    if (p.level !== level - 1) throw new ApiError(400, `A level-${level} category needs a level-${level - 1} parent`);
  } else if (level !== 1) {
    throw new ApiError(400, 'Only level-1 categories can have no parent');
  }

  const category = await Category.create(req.body);
  created(res, category);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { parent } = req.body as { parent?: string | null };

  if (parent !== undefined) {
    const current = await Category.findById(req.params.id).select('level').lean();
    if (!current) throw new ApiError(404, 'Category not found');
    if (parent === null) {
      if (current.level !== 1) throw new ApiError(400, 'Only level-1 categories can have no parent');
    } else {
      if (parent === req.params.id) throw new ApiError(400, 'A category cannot be its own parent');
      const p = await Category.findById(parent).select('level').lean();
      if (!p) throw new ApiError(400, 'Parent category not found');
      if (p.level !== current.level - 1) throw new ApiError(400, `A level-${current.level} category needs a level-${current.level - 1} parent`);
    }
  }

  const category = await Category.findByIdAndUpdate(req.params.id, req.body as Partial<ICategory>, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new ApiError(404, 'Category not found');
  ok(res, category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const [childCount, productCount] = await Promise.all([
    Category.countDocuments({ parent: req.params.id }),
    Product.countDocuments({ category: req.params.id }),
  ]);
  if (childCount > 0) throw new ApiError(400, 'Delete or move its sub-categories first');
  if (productCount > 0) throw new ApiError(400, 'Move or delete its products first');

  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');
  ok(res, { message: 'Category deleted' });
});

/* ============ Orders ============ */

export const listOrdersAdmin = asyncHandler(async (req, res) => {
  const { status, q, rider, page, limit } = req.query as unknown as {
    status?: string;
    q?: string;
    rider?: string;
    page: number;
    limit: number;
  };

  const filter: FilterQuery<IOrder> = {};
  if (status) filter.status = status;
  if (q) filter.orderNumber = { $regex: escapeRegex(q), $options: 'i' };
  // "Search by delivery boy name"
  const byRider = await riderFilter(rider);
  if (byRider) Object.assign(filter, byRider);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-statusHistory -deliveryOtp')
      .populate('user', 'name phone')
      .populate('shop', 'name')
      .populate('rider', 'name phone')
      .lean(),
    Order.countDocuments(filter),
  ]);
  ok(res, await withRiderPool(orders), pageMeta(page, limit, total));
});

export const getOrderAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name phone email')
    .populate('shop', 'name phone address location')
    .populate('rider', 'name phone')
    .lean();
  if (!order) throw new ApiError(404, 'Order not found');
  ok(res, order);
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body as { status: IOrder['status']; note?: string };
  ok(res, await moveOrderStatus(String(req.params.id), status, note, 'admin'));
});

export const freeRidersAdmin = asyncHandler(async (req, res) => {
  ok(res, await freeRidersForOrder(String(req.params.id)));
});

export const assignRiderAdmin = asyncHandler(async (req, res) => {
  ok(res, await assignRiderToOrder(String(req.params.id), req.body.rider, 'admin'));
});

export const assignShiprocketAdmin = asyncHandler(async (req, res) => {
  ok(res, await assignToShiprocket(String(req.params.id), 'admin'));
});

/** Refund an online-paid order back to the customer through Razorpay. */
export const refundOrderAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.paymentMethod !== 'online' || !order.paymentRef) throw new ApiError(400, 'This order was not paid online, so there is nothing to refund.');
  if (order.paymentStatus === 'refunded') throw new ApiError(409, 'This order is already refunded.');
  await refundRazorpayPayment(order.paymentRef, order.total);
  order.paymentStatus = 'refunded';
  order.statusHistory.push({ status: order.status, at: new Date(), note: 'Payment refunded by admin' });
  await order.save();
  ok(res, order);
});

/* ============ Shops ============ */

/** No shop-owner portal exists yet, so admin-created shops share one internal owner account. */
async function getOrCreateSystemShopOwner(): Promise<Types.ObjectId> {
  const existing = await User.findOne({ phone: '9000000000' }).select('_id').lean();
  if (existing) return existing._id as Types.ObjectId;
  const created2 = await User.create({
    name: 'Bingoor Shops',
    phone: '9000000000',
    password: sha256(`shop-owner-${Date.now()}-${Math.random()}`).slice(0, 20),
    role: 'shop',
  });
  return created2._id as Types.ObjectId;
}

export const listShopsAdmin = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const [shops, total] = await Promise.all([
    Shop.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Shop.countDocuments({}),
  ]);
  ok(res, shops, pageMeta(page, limit, total));
});

export const createShop = asyncHandler(async (req, res) => {
  const owner = await getOrCreateSystemShopOwner();
  const { location, ...rest } = req.body as { location: { lat: number; lng: number }; [k: string]: unknown };

  const shop = await Shop.create({
    ...rest,
    owner,
    location: { type: 'Point', coordinates: [location.lng, location.lat] },
  });
  created(res, shop);
});

export const updateShop = asyncHandler(async (req, res) => {
  const { location, ...rest } = req.body as { location?: { lat: number; lng: number }; [k: string]: unknown };
  const update: Record<string, unknown> = { ...rest };
  if (location) update.location = { type: 'Point', coordinates: [location.lng, location.lat] };

  const shop = await Shop.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!shop) throw new ApiError(404, 'Shop not found');
  ok(res, shop);
});

export const deleteShop = asyncHandler(async (req, res) => {
  const productCount = await Product.countDocuments({ shop: req.params.id });
  if (productCount > 0) throw new ApiError(400, 'Move or delete its products first');

  const shop = await Shop.findByIdAndDelete(req.params.id);
  if (!shop) throw new ApiError(404, 'Shop not found');
  ok(res, { message: 'Shop deleted' });
});

/* ============ Users ============ */

export const listUsersAdmin = asyncHandler(async (req, res) => {
  const { role, q, page, limit } = req.query as unknown as {
    role?: string;
    q?: string;
    page: number;
    limit: number;
  };

  const filter: FilterQuery<IUser> = { deletedAt: { $exists: false } };
  if (role) filter.role = role;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name phone email role warehouse warehouses isActive lastLoginAt createdAt')
      .populate('warehouse', 'name')
      .populate('warehouses', 'name')
      .lean(),
    User.countDocuments(filter),
  ]);
  ok(res, users, pageMeta(page, limit, total));
});

export const createRider = asyncHandler(async (req, res) => {
  const { name, phone, email, password, warehouse, warehouses, longDistance } = req.body as {
    longDistance?: boolean;
    name: string;
    phone: string;
    email?: string;
    password: string;
    warehouse?: string;
    warehouses?: string[];
  };
  const ids = [...new Set(warehouses?.length ? warehouses : warehouse ? [warehouse] : [])];
  if (!ids.length) throw new ApiError(400, 'Choose at least one warehouse');
  const found = await Shop.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw new ApiError(400, 'Warehouse not found');
  const rider = await User.create({ name, phone, email, password, role: 'rider', warehouse: ids[0], warehouses: ids, isActive: true, riderLongDistance: !!longDistance });
  const safeRider = await User.findById(rider._id).select('name phone email role warehouse warehouses isActive createdAt').populate('warehouse', 'name').populate('warehouses', 'name');
  created(res, safeRider);
});

export const updateUserAdmin = asyncHandler(async (req, res) => {
  const { password, email, ...update } = req.body as Partial<IUser> & { password?: string; email?: string };
  if (update.warehouse) {
    const warehouse = await Shop.findById(update.warehouse).select('_id').lean();
    if (!warehouse) throw new ApiError(400, 'Warehouse not found');
  }
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  // A phone number or email can belong to one account of each kind (customer, rider, warehouse...).
  if (user.deletedAt) throw new ApiError(404, 'User not found');
  if (update.phone && update.phone !== user.phone) {
    if (await User.exists({ phone: update.phone, role: update.role ?? user.role, _id: { $ne: user._id } })) throw new ApiError(409, 'That phone number is already used by another account');
  }
  if (email && email !== user.email) {
    if (await User.exists({ email, role: update.role ?? user.role, _id: { $ne: user._id } })) throw new ApiError(409, 'That email is already used by another account');
  }
  if (req.user!.id === String(user._id) && (update.isActive === false || (update.role && update.role !== user.role))) {
    throw new ApiError(400, 'You cannot block or change the role of your own account');
  }

  const wh = (update as { warehouses?: string[] }).warehouses;
  if (wh) {
    const ids = [...new Set(wh)];
    if ((await Shop.countDocuments({ _id: { $in: ids } })) !== ids.length) throw new ApiError(400, 'Warehouse not found');
    (update as Partial<IUser>).warehouses = ids as never;
    (update as Partial<IUser>).warehouse = ids[0] as never;
  } else if ('warehouse' in update) {
    // Single-warehouse edit: keep the list in step with it.
    (update as Partial<IUser>).warehouses = (update.warehouse ? [update.warehouse] : []) as never;
  }
  Object.assign(user, update);
  if (email !== undefined) user.email = email || undefined;
  if (password) {
    user.password = password; // hashed by the model on save
    user.refreshTokens = []; // signs the person out of every device
  }
  await user.save();

  const saved = await User.findById(user._id).select('name phone email role warehouse isActive lastLoginAt createdAt warehouses').populate('warehouse', 'name').populate('warehouses', 'name');
  ok(res, saved);
});

/**
 * Deletes an account for good. An account that already has orders cannot be deleted
 * (the orders would lose their customer or rider): block it instead.
 */
export const deleteUserAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name role');
  if (!user) throw new ApiError(404, 'User not found');
  if (req.user!.id === String(user._id)) throw new ApiError(400, 'You cannot delete your own account');
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) throw new ApiError(400, 'The last admin account cannot be deleted');

  if (user.role === 'rider') {
    if (await Order.exists({ rider: user._id, status: 'out_for_delivery' })) {
      throw new ApiError(409, 'Complete or reassign the active deliveries before deleting this rider.');
    }
    if (((await codSummary([user._id])).get(String(user._id))?.pending ?? 0) > 0) {
      throw new ApiError(409, 'Collect and settle this rider’s pending COD cash before deleting the rider.');
    }
    // Retain the identity referenced by orders, COD and wallet records.
    await User.updateOne({ _id: user._id }, { $set: { isActive: false, deletedAt: new Date(), refreshTokens: [], lastSeenAt: null } });
    return ok(res, { deleted: true });
  }

  const orders = await Order.countDocuments({ $or: [{ user: user._id }, { rider: user._id }] });
  if (orders > 0) {
    throw new ApiError(409, `${user.name} has ${orders} order${orders === 1 ? '' : 's'} on record, so the account cannot be deleted. Block it instead.`);
  }
  await Cart.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });
  ok(res, { deleted: true });
});
/* ============ Banners ============ */

export const listBannersAdmin = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 }).populate('category', 'name slug').lean();
  ok(res, banners);
});

async function assertBannerCategory(category: string | null | undefined) {
  if (!category) return;
  const exists = await Category.exists({ _id: category });
  if (!exists) throw new ApiError(400, 'Linked category not found');
}

export const createBanner = asyncHandler(async (req, res) => {
  const body = req.body as Partial<IBanner> & { category?: string | null };
  await assertBannerCategory(body.category);
  const banner = await Banner.create(body);
  created(res, banner);
});

export const updateBanner = asyncHandler(async (req, res) => {
  const body = req.body as Partial<IBanner> & { category?: string | null };
  await assertBannerCategory(body.category);
  const banner = await Banner.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!banner) throw new ApiError(404, 'Banner not found');
  ok(res, banner);
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw new ApiError(404, 'Banner not found');
  ok(res, { message: 'Banner deleted' });
});

/* ============ Coupons ============ */

export const listCouponsAdmin = asyncHandler(async (req, res) => {
  const { q, isActive, page, limit } = req.query as unknown as {
    q?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  };

  const filter: FilterQuery<ICoupon> = {};
  if (q) filter.code = { $regex: escapeRegex(q.toUpperCase()), $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive;

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('shops', 'name')
      .lean(),
    Coupon.countDocuments(filter),
  ]);
  ok(res, coupons, pageMeta(page, limit, total));
});

export const createCoupon = asyncHandler(async (req, res) => {
  const body = req.body as Partial<ICoupon> & { code: string };
  const exists = await Coupon.findOne({ code: body.code.toUpperCase() });
  if (exists) throw new ApiError(409, 'A coupon with that code already exists');

  const coupon = await Coupon.create(body);
  created(res, coupon);
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const body = req.body as Partial<ICoupon>;
  if (body.code) {
    const clash = await Coupon.findOne({ code: body.code.toUpperCase(), _id: { $ne: req.params.id } });
    if (clash) throw new ApiError(409, 'A coupon with that code already exists');
  }
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  ok(res, coupon);
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  ok(res, { message: 'Coupon deleted' });
});

/* ============ Account ============ */

/** The signed-in admin's own profile — the Settings page reads this. */
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id).select('name phone email role warehouse isActive lastLoginAt createdAt')
      .populate('warehouse', 'name');
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (email !== undefined) update.email = email.toLowerCase();
  if (phone !== undefined) update.phone = phone;

  const user = await User.findByIdAndUpdate(req.user!.id, update, { new: true, runValidators: true }).select(
    'name phone email role isActive lastLoginAt createdAt',
  );
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, user);
});

/** Change the signed-in admin's password; every other session is signed out. */
export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  const user = await User.findById(req.user!.id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(currentPassword))) throw new ApiError(401, 'Current password is wrong');

  user.password = newPassword;
  user.refreshTokens = [] as unknown as typeof user.refreshTokens;
  await user.save();

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [{ hash: sha256(refreshToken), createdAt: new Date() }], $slice: -MAX_SESSIONS } } },
  );
  ok(res, { message: 'Password changed', accessToken, refreshToken });
});
