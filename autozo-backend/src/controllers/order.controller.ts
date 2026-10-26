import { notifyOrderPlaced, notifyOrderStatus } from '../services/orderNotify.service';
import crypto from 'crypto';
import { FilterQuery, Types } from 'mongoose';
import { Cart, MAX_QTY_PER_ITEM } from '../models/Cart';
import { CUSTOMER_CANCELLABLE, IOrder, Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { cartPointsTotal, getCartView, lineIssue, resolveCart } from '../services/cart.service';
import { paymentFeePct, paymentOptions, quoteDelivery, Slot } from '../services/pricing.service';
import { loadSettings, productRules } from '../services/settings.service';
import { createRazorpayOrder, razorpayEnabled, razorpayKeys, razorpayWebhookSecret, refundRazorpayPayment, verifyRazorpaySignature } from '../services/razorpay.service';
import { PaymentIntent } from '../models/PaymentIntent';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { haversineKm, round2 } from '../utils/helpers';
import { created, ok, pageMeta } from '../utils/response';

const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

function newOrderNumber(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `BG${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** What the customer sees. The delivery OTP is shown only while the order is still on its way. */
function presentOrder<T extends { status: string; deliveryOtp?: string }>(order: T) {
  const { deliveryOtp, ...rest } = order;
  const showOtp = !['delivered', 'cancelled', 'rejected'].includes(order.status);
  return showOtp ? { ...rest, deliveryOtp } : rest;
}

async function restoreStock(items: { product: Types.ObjectId | string; quantity: number }[]) {
  await Promise.all(
    items.map((i) =>
      Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity, soldCount: -i.quantity } }),
    ),
  );
}

/** Straight-line km from the warehouse to the delivery pin, or null when either is unknown. */
function distanceTo(
  shop: { location?: { coordinates?: number[] } },
  to?: { lat: number; lng: number },
): number | null {
  const c = shop.location?.coordinates;
  if (!c || c.length < 2 || !to?.lat || !to?.lng) return null;
  return haversineKm(to.lat, to.lng, c[1], c[0]);
}

/* ---------------- place order ---------------- */
type PlaceBody = { addressId: string; paymentMethod: 'cod' | 'online'; payOption?: 'upi' | 'debit' | 'netbanking' | 'credit' | 'rupay'; tip?: number; note?: string; slot?: Slot };

/**
 * Validates the cart and, unless this is only a quote, reserves stock and creates
 * the orders. `quote` stops after validation and returns what the customer owes,
 * so an online payment can be started for the right amount.
 */
async function runPlaceOrder(
  userId: string,
  body: PlaceBody,
  opts: { quote?: boolean; paid?: { ref: string } } = {},
): Promise<{ grandTotal: number; checkoutId?: string; orders?: ReturnType<typeof presentOrder>[] }> {
  const { addressId, paymentMethod, note, slot = 'instant' } = body;
  const payOption = paymentMethod === 'cod' ? 'cod' : (body.payOption ?? 'upi');

  const user = await User.findById(userId).select('addresses');
  const address = user?.addresses.id(addressId);
  if (!address) throw new ApiError(404, 'Delivery address not found');
  // The rider navigates to this pin and the delivery range is checked against it.
  if (!address.location?.lat || !address.location?.lng) {
    throw new ApiError(400, 'Please pin your exact location on this address (tap "Use my current location") before ordering.');
  }
  if (paymentMethod === 'online' && !(await razorpayEnabled())) {
    throw new ApiError(400, 'Online payment is not switched on yet. Please choose Cash on Delivery for now.');
  }

  const groups = await resolveCart(userId);
  if (groups.length === 0) throw new ApiError(400, 'Your cart is empty');
  const { settings } = await loadSettings();

  // Hidden cart-points rule: checkout stays closed until the basket reaches the target.
  if (settings.cartPoints?.enabled && cartPointsTotal(groups) < settings.cartPoints.target) {
    throw new ApiError(409, 'Please add 1 product from the list below your cart to continue.', [{ reason: 'points_short' }]);
  }

  /* ---- validate everything before touching stock ---- */
  const problems: { shop?: string; productId?: string; name?: string; reason: string }[] = [];
  let owed = 0;
  for (const g of groups) {
    if (!g.shop.isActive || !g.shop.isOpen) {
      problems.push({ shop: g.shop.name, reason: 'shop_closed' });
      continue;
    }
    let subtotal = 0;
    for (const l of g.lines) {
      const issue = lineIssue(g, l);
      if (issue) problems.push({ shop: g.shop.name, productId: String(l.product._id), name: l.product.name, reason: issue });
      else subtotal += l.product.price * l.quantity;
      // Some aisles (fruits & vegetables by default) cannot be paid in cash.
      const rules = productRules(l.product.category, l.product.paymentMode);
      if (paymentMethod === 'cod' && !rules.codAvailable) {
        problems.push({ shop: g.shop.name, productId: String(l.product._id), name: l.product.name, reason: 'cod_unavailable' });
      }
      if (paymentMethod === 'online' && !rules.onlineAvailable) {
        problems.push({ shop: g.shop.name, productId: String(l.product._id), name: l.product.name, reason: 'online_unavailable' });
      }
    }
    if (subtotal < g.shop.minOrderAmount) {
      problems.push({ shop: g.shop.name, reason: `min_order_${g.shop.minOrderAmount}` });
    }
    const km = distanceTo(g.shop, address.location);
    const quote = quoteDelivery(settings, { subtotal, distanceKm: km, slot });
    if (!quote.meetsMinOrder) problems.push({ shop: g.shop.name, reason: `min_order_${quote.minOrder}` });
    owed += subtotal + quote.deliveryFee + quote.twoHourFee + quote.handlingFee;
  }
  // #36: the chosen way to pay can carry a charge (a percent of the whole bill).
  const payOpt = paymentOptions(settings).find((o) => o.key === payOption);
  if (payOpt && !payOpt.enabled) problems.push({ reason: `pay_option_off_${payOption}` });
  const feePct = paymentFeePct(payOpt, owed);
  if (problems.length) throw new ApiError(409, 'Some items in your cart need attention', problems);
  const tip = Math.max(0, Math.round(body.tip ?? 0));
  if (opts.quote) return { grandTotal: round2(owed + round2((owed * feePct) / 100) + tip) };

  /* ---- reserve stock atomically (rolled back on any failure) ---- */
  const reserved: { product: Types.ObjectId; quantity: number }[] = [];
  const createdOrders: Types.ObjectId[] = [];
  const checkoutId = crypto.randomUUID();

  try {
    for (const g of groups) {
      for (const l of g.lines) {
        const r = await Product.updateOne(
          { _id: l.product._id, isActive: true, stock: { $gte: l.quantity } },
          { $inc: { stock: -l.quantity, soldCount: l.quantity } },
        );
        if (r.modifiedCount !== 1) {
          throw new ApiError(409, `"${l.product.name}" just went out of stock`, [
            { productId: String(l.product._id), name: l.product.name, reason: 'out_of_stock' },
          ]);
        }
        reserved.push({ product: l.product._id, quantity: l.quantity });
      }
    }

    const orders = [];
    for (const g of groups) {
      const items = g.lines.map((l) => ({
        product: l.product._id,
        name: l.product.name,
        image: l.product.images[0],
        icon: l.product.icon,
        unit: l.product.unit,
        price: l.product.price,
        mrp: l.product.mrp,
        quantity: l.quantity,
        lineTotal: round2(l.product.price * l.quantity),
        ...(l.product.hsn ? { hsn: l.product.hsn } : {}),
        ...(l.product.gstRate !== undefined && l.product.gstRate !== null ? { gstRate: l.product.gstRate } : {}),
        ...(l.product.seller ? { seller: l.product.seller } : {}),
      }));
      const sellerIds = [...new Set(items.filter((i) => i.seller).map((i) => String(i.seller)))];
      const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
      const quote = quoteDelivery(settings, { subtotal, distanceKm: distanceTo(g.shop, address.location), slot });
      const deliveryFee = quote.deliveryFee + quote.twoHourFee;
      const payFee = round2(((subtotal + deliveryFee + quote.handlingFee) * feePct) / 100);
      // The tip rides on the first order of the checkout only.
      const orderTip: number = createdOrders.length === 0 ? tip : 0;
      const days = Math.max(quote.days, ...g.lines.map((l) => productRules(l.product.category).deliveryDays ?? 0));

      const order = await Order.create({
        orderNumber: newOrderNumber(),
        checkoutId,
        user: userId,
        shop: g.shop._id,
        ...(days ? { deliveryDays: days } : {}),
        slot,
        handlingFee: quote.handlingFee,
        redOrder: quote.redOrder,
        longDistance: quote.longDistance,
        ...(sellerIds.length ? { sellerIds } : {}),
        ...(quote.distanceKm !== null ? { distanceKm: quote.distanceKm } : {}),
        items,
        address: {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          location: address.location,
        },
        paymentMethod,
        payOption,
        paymentFee: payFee,
        tip: orderTip,
        // Online orders are only created after the gateway confirmed the payment.
        paymentStatus: opts.paid ? 'paid' : 'pending',
        ...(opts.paid ? { paymentRef: opts.paid.ref } : {}),
        status: 'placed',
        statusHistory: [{ status: 'placed', at: new Date() }],
        subtotal,
        deliveryFee,
        discount: 0,
        total: round2(subtotal + deliveryFee + quote.handlingFee + payFee + orderTip),
        note,
        deliveryOtp: String(crypto.randomInt(1000, 10000)),
      });
      createdOrders.push(order._id);
      orders.push(order);
    }

    await Cart.updateOne({ user: userId }, { $set: { items: [] } });
    if (!opts.quote) for (const o of orders) notifyOrderPlaced(o, !!opts.paid);

    return {
      checkoutId,
      orders: orders.map((o) => presentOrder(o.toObject())),
      grandTotal: round2(orders.reduce((s, o) => s + o.total, 0)),
    };
  } catch (err) {
    // Undo partial work so the customer's cart and shop stock stay consistent
    if (createdOrders.length) await Order.deleteMany({ _id: { $in: createdOrders } });
    if (reserved.length) await restoreStock(reserved);
    throw err;
  }
}

export const placeOrder = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const body = req.body as PlaceBody;

  if (body.paymentMethod === 'online') {
    // Start the payment: nothing is ordered until it is paid and verified.
    const { grandTotal } = await runPlaceOrder(userId, body, { quote: true });
    const rzp = await createRazorpayOrder(grandTotal, `bg-${Date.now()}`, { user: userId });
    await PaymentIntent.create({
      user: userId,
      razorpayOrderId: rzp.id,
      amount: grandTotal,
      payload: { addressId: body.addressId, note: body.note, slot: body.slot ?? 'instant', payOption: body.payOption ?? 'upi', tip: body.tip ?? 0 },
    });
    // The client opens Razorpay showing only the method the customer picked (its charge is already in the amount).
    return created(res, { requiresPayment: true, razorpayOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency, keyId: (await razorpayKeys())!.keyId, payOption: body.payOption ?? 'upi' });
  }

  created(res, await runPlaceOrder(userId, body));
});

/** The customer paid in the Razorpay window: verify it, then place the orders as paid. */
export const confirmOnlinePayment = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
  if (!(await razorpayEnabled())) throw new ApiError(400, 'Online payment is not switched on.');
  if (!(await verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature))) {
    throw new ApiError(400, 'We could not verify this payment. If money was deducted it will be refunded.');
  }
  // Claim the intent once, so a repeated confirm never creates a second order.
  const intent = await PaymentIntent.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id, user: userId, status: 'created' },
    { $set: { status: 'paid', paymentId: razorpay_payment_id } },
    { new: true },
  );
  if (!intent) throw new ApiError(409, 'This payment was already processed.');
  try {
    const result = await runPlaceOrder(userId, { ...intent.payload, paymentMethod: 'online' }, { paid: { ref: razorpay_payment_id } });
    created(res, result);
  } catch (err) {
    // Paid but the order could not be created (stock changed): give the money back.
    await refundRazorpayPayment(razorpay_payment_id, intent.amount).catch(() => undefined);
    await PaymentIntent.updateOne({ _id: intent._id }, { $set: { status: 'refunded' } });
    throw err instanceof ApiError ? new ApiError(err.statusCode, `${err.message}. Your payment is being refunded.`, err.details) : err;
  }
});

/**
 * Server-to-server fallback for online payments (ISSUE-02).
 *
 * The client-driven flow (`/orders/online/confirm`) only completes if the app
 * is alive after payment. If the phone dies, the app crashes or the network
 * drops right after the customer pays, Razorpay still charged them but no order
 * would ever be created. Razorpay also calls this webhook, so the order is
 * placed (or the payment refunded) regardless of the client.
 *
 * Verification uses HMAC-SHA256 over the RAW request body (captured in app.ts)
 * compared with crypto.timingSafeEqual. Claiming the PaymentIntent atomically
 * (status: 'created' -> 'paid') makes this idempotent and safe against a race
 * with `/orders/online/confirm`: whichever arrives first creates the order, the
 * other is a no-op.
 */
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = await razorpayWebhookSecret();
  const signature = req.headers['x-razorpay-signature'];
  const raw = (req as typeof req & { rawBody?: Buffer }).rawBody;
  // Nothing to verify against (webhook secret not configured) or no raw body:
  // acknowledge so Razorpay stops retrying, but do not act on an unverified call.
  if (!secret || typeof signature !== 'string' || !raw) return res.status(200).json({ received: true });

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const body = req.body as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } }; order?: { entity?: { id?: string } } };
  };
  const payment = body.payload?.payment?.entity;
  const razorpayOrderId = payment?.order_id ?? body.payload?.order?.entity?.id;
  const paymentId = payment?.id;

  if ((body.event === 'payment.captured' || body.event === 'order.paid') && razorpayOrderId) {
    // Claim once: if the client's confirm already placed the order, status is no
    // longer 'created' and this returns null (no duplicate order).
    const intent = await PaymentIntent.findOneAndUpdate(
      { razorpayOrderId, status: 'created' },
      { $set: { status: 'paid', ...(paymentId ? { paymentId } : {}) } },
      { new: true },
    );
    if (intent) {
      try {
        await runPlaceOrder(
          String(intent.user),
          { ...intent.payload, paymentMethod: 'online' },
          { paid: { ref: paymentId ?? intent.razorpayOrderId } },
        );
      } catch {
        // Paid but the order could not be created (e.g. stock changed): refund.
        if (paymentId) await refundRazorpayPayment(paymentId, intent.amount).catch(() => undefined);
        await PaymentIntent.updateOne({ _id: intent._id }, { $set: { status: 'refunded' } });
      }
    }
  }

  // Always 200 once handled, so Razorpay does not keep retrying.
  res.status(200).json({ received: true });
});

/* ---------------- read ---------------- */
export const listOrders = asyncHandler(async (req, res) => {
  const { status, active, page, limit } = req.query as unknown as {
    status?: string;
    active?: boolean;
    page: number;
    limit: number;
  };

  const filter: FilterQuery<IOrder> = { user: req.user!.id };
  if (status) filter.status = status;
  else if (active === true) filter.status = { $in: ACTIVE_STATUSES };
  else if (active === false) filter.status = { $nin: ACTIVE_STATUSES };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-statusHistory')
      .populate('shop', 'name slug logo')
      .lean(),
    Order.countDocuments(filter),
  ]);

  ok(res, orders.map(presentOrder), pageMeta(page, limit, total));
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.id })
    .populate('shop', 'name slug logo phone address location')
    .populate('rider', 'name phone avatar')
    .lean();
  if (!order) throw new ApiError(404, 'Order not found');

  // Riders are only revealed once they have the parcel
  const riderVisible = ['out_for_delivery', 'delivered'].includes(order.status);
  // Live position only matters (and is only shared) while the parcel is on its way.
  const tracking = order.status === 'out_for_delivery' ? order.riderLocation : undefined;
  ok(res, presentOrder(riderVisible ? { ...order, riderLocation: tracking } : { ...order, rider: undefined, riderLocation: undefined }));
});

/* ---------------- cancel ---------------- */
export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason?: string };

  const existing = await Order.findOne({ _id: req.params.id, user: req.user!.id }).select('status paymentStatus');
  if (!existing) throw new ApiError(404, 'Order not found');

  // Conditional update guards against the shop accepting/preparing at the same moment
  const order = await Order.findOneAndUpdate(
    { _id: existing._id, status: { $in: CUSTOMER_CANCELLABLE } },
    {
      $set: {
        status: 'cancelled',
        cancelledBy: 'customer',
        cancelReason: reason,
        ...(existing.paymentStatus === 'paid' ? { paymentStatus: 'refund_pending' } : {}),
      },
      $push: { statusHistory: { status: 'cancelled', at: new Date(), note: reason } },
    },
    { new: true },
  );
  if (!order) {
    throw new ApiError(409, `This order can no longer be cancelled (it is ${existing.status.replace(/_/g, ' ')})`);
  }

  await restoreStock(order.items);

  // ISSUE-01: a paid online order must get its money back, not just be flagged
  // refund_pending. Try the refund now; if it fails, leave it refund_pending so
  // an admin can retry via POST /admin/orders/:id/refund.
  if (existing.paymentStatus === 'paid' && order.paymentMethod === 'online' && order.paymentRef) {
    try {
      await refundRazorpayPayment(order.paymentRef, order.total);
      order.paymentStatus = 'refunded';
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'refunded' } });
    } catch {
      // keep refund_pending (already set above); admin can retry the refund.
    }
  }

  notifyOrderStatus(order, 'cancelled');
  ok(res, presentOrder(order.toObject()));
});

/* ---------------- reorder ---------------- */
export const reorder = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const order = await Order.findOne({ _id: req.params.id, user: userId }).lean();
  if (!order) throw new ApiError(404, 'Order not found');

  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) }, isActive: true, stock: { $gt: 0 } })
    .select('stock')
    .lean();
  const stockById = new Map(products.map((p) => [String(p._id), p.stock]));

  const cart = await Cart.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, new: true });
  const skipped: string[] = [];

  for (const item of order.items) {
    const stock = stockById.get(String(item.product));
    if (!stock) {
      skipped.push(item.name);
      continue;
    }
    const existing = cart.items.find((i) => String(i.product) === String(item.product));
    const qty = Math.min((existing?.quantity ?? 0) + item.quantity, stock, MAX_QTY_PER_ITEM);
    if (existing) existing.quantity = qty;
    else cart.items.push({ product: item.product, quantity: qty });
  }
  await cart.save();

  ok(res, { cart: await getCartView(userId), skipped });
});
