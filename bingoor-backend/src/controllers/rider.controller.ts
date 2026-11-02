import { FilterQuery } from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { riderWarehouseIds, User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import { RequestHandler } from 'express';
import { autoPauseIfOverLimit, codSummary } from '../services/rider.service';
import { creditDeliveryEarning } from '../services/riderPay.service';
import { creditSellerEarnings } from '../services/sellerPay.service';
import { loadSettings } from '../services/settings.service';

/** Every rider request marks them online (green dot in the admin panel). */
export const touchRider: RequestHandler = (req, _res, next) => {
  if (req.user?.role === 'rider') {
    User.updateOne({ _id: req.user.id }, { $set: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  next();
};

export const getProfile = asyncHandler(async (req, res) => {
  const rider = await User.findById(req.user!.id)
    .select('name phone email role warehouse warehouses isActive lastLoginAt createdAt riderPaused riderPausedAt riderCancelCount')
    .populate('warehouse', 'name')
    .populate('warehouses', 'name')
    .lean();
  if (!rider) throw new ApiError(404, 'Rider not found');

  const { settings } = await loadSettings();
  const limit = settings.riderCodLimit ?? 2000;
  const cod = (await codSummary([rider._id])).get(String(rider._id));
  const pending = cod?.pending ?? 0;

  // The two bell messages: hand in the cash, and (once paused) service stopped.
  const notices: string[] = [];
  if (limit && pending >= limit) notices.push('Submit order total payment to Cash department');
  if (rider.riderPaused) notices.push('Your delivery service has been stopped for a short time, so submit orders payment to Cash department');

  ok(res, {
    ...rider,
    codPending: pending,
    codCollected: cod?.total ?? 0,
    codLimit: limit,
    deliveredCount: cod?.deliveries ?? 0,
    cancelledCount: rider.riderCancelCount ?? 0,
    paused: !!rider.riderPaused,
    notices,
  });
});

/** Most open orders (pickups + the rider's own deliveries) one app screen ever holds. */
const OPEN_CAP = 100;
/** Orders the warehouse has accepted are shown to riders straight away; they can take one once it is ready. */
const UPCOMING = ['accepted', 'preparing', 'ready_for_pickup'];

const findRiderOrders = (filter: FilterQuery<IOrder>, sort: 1 | -1, skip: number, limit: number) =>
  Order.find(filter).sort({ createdAt: sort }).skip(skip).limit(limit)
    .select('-statusHistory -deliveryOtp').populate('shop', 'name address phone location').populate('user', 'name phone').lean();

export const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
  const rider = await User.findById(req.user!.id).select('warehouse warehouses riderPaused riderLongDistance').lean();
  const shops = rider ? riderWarehouseIds(rider) : [];
  if (!rider || !shops.length) throw new ApiError(400, 'No warehouse is assigned to this rider');
  // Long-distance orders go only to the special rider; everyone else never sees them.
  const base: FilterQuery<IOrder> = { ...(rider.riderLongDistance ? { longDistance: true } : { longDistance: { $ne: true } }), shop: { $in: shops } };
  const pickups: FilterQuery<IOrder> = { ...base, status: 'ready_for_pickup' };
  const active: FilterQuery<IOrder> = { ...base, rider: req.user!.id, status: 'out_for_delivery' };
  const delivered: FilterQuery<IOrder> = { ...base, rider: req.user!.id, status: 'delivered' };

  if (!status) {
    // The app's main list. Open work comes first and in full; delivered history is only the latest page.
    // (One list sorted oldest-first used to fill up with old deliveries, so new pickups never showed.)
    // A paused rider sees only their own orders - no new pickups until resumed.
    const open: FilterQuery<IOrder> = rider.riderPaused ? active : { ...base, $or: [{ status: { $in: UPCOMING }, rider: { $exists: false } }, { rider: req.user!.id, status: 'out_for_delivery' }] };
    const [openOrders, doneOrders, doneTotal] = await Promise.all([
      page === 1 ? findRiderOrders(open, 1, 0, OPEN_CAP) : Promise.resolve([]),
      findRiderOrders(delivered, -1, (page - 1) * limit, limit),
      Order.countDocuments(delivered),
    ]);
    return ok(res, [...openOrders, ...doneOrders], { ...pageMeta(page, limit, doneTotal), open: openOrders.length });
  }

  if (status === 'ready_for_pickup' && rider.riderPaused) return ok(res, [], pageMeta(page, limit, 0));
  const filter = status === 'ready_for_pickup' ? pickups : status === 'out_for_delivery' ? active : delivered;
  // Pickups oldest first (first come, first served); history newest first.
  const sort = status === 'delivered' ? -1 : 1;
  const [orders, total] = await Promise.all([
    findRiderOrders(filter, sort, (page - 1) * limit, limit),
    Order.countDocuments(filter),
  ]);
  ok(res, orders, pageMeta(page, limit, total));
});

export const acceptOrder = asyncHandler(async (req, res) => {
  const rider = await User.findById(req.user!.id).select('warehouse warehouses riderPaused riderLongDistance').lean();
  const shops = rider ? riderWarehouseIds(rider) : [];
  if (!rider || !shops.length) throw new ApiError(400, 'No warehouse is assigned to this rider');
  if (rider.riderPaused) {
    throw new ApiError(403, 'Your delivery service has been stopped for a short time. Submit your COD payment to the cash department.');
  }
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, shop: { $in: shops }, status: 'ready_for_pickup', rider: { $exists: false }, ...(rider.riderLongDistance ? { longDistance: true } : { longDistance: { $ne: true } }) },
    { $set: { rider: req.user!.id, status: 'out_for_delivery' }, $push: { statusHistory: { status: 'out_for_delivery', at: new Date(), note: 'Accepted by rider' } } },
    { new: true },
  ).select('-statusHistory -deliveryOtp').populate('shop', 'name address phone location').populate('user', 'name phone').lean();
  if (!order) throw new ApiError(409, 'This order is no longer available for pickup');
  ok(res, order);
});

export const deliverOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, rider: req.user!.id, status: 'out_for_delivery' });
  if (!order) throw new ApiError(404, 'Active delivery not found');
  if (!order.deliveryOtp || String(order.deliveryOtp).trim() !== req.body.otp.trim()) {
    throw new ApiError(400, `Incorrect delivery OTP for order ${order.orderNumber}. Ask the customer to open this order and share its 4-digit delivery OTP.`);
  }
  order.status = 'delivered';
  order.deliveredAt = new Date();
  order.statusHistory.push({ status: 'delivered', at: new Date(), note: 'Delivered by rider' });
  await order.save();
  // The rider earns their delivery pay the moment the order is handed over.
  await creditDeliveryEarning(order._id).catch(() => undefined);
  // Sellers earn their net (item sales minus commission) on the same delivery.
  await creditSellerEarnings(order._id).catch(() => undefined);
  const result = await Order.findById(order._id).select('-statusHistory -deliveryOtp').populate('shop', 'name').populate('user', 'name phone').lean();
  // Cash on delivery: pause the rider once their unsubmitted cash crosses the limit.
  if (order.paymentMethod === 'cod') await autoPauseIfOverLimit(req.user!.id);
  ok(res, result);
});

/**
 * The rider drops a delivery they accepted: it goes back to "ready for pickup"
 * for another rider, and counts against this rider in the admin panel.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason?: string };
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, rider: req.user!.id, status: 'out_for_delivery' },
    {
      $set: { status: 'ready_for_pickup' },
      $unset: { rider: 1, riderLocation: 1 },
      $push: { statusHistory: { status: 'ready_for_pickup', at: new Date(), note: `Rider cancelled${reason ? `: ${reason}` : ''}` } },
    },
    { new: true },
  );
  if (!order) throw new ApiError(404, 'Active delivery not found');
  await User.updateOne({ _id: req.user!.id }, { $inc: { riderCancelCount: 1 } });
  ok(res, { message: 'Delivery cancelled. The order is back in the pickup queue.' });
});
/**
 * The rider app reports its position every few seconds while it has a parcel.
 * It is written onto each order the rider is carrying so the customer's order
 * page can show where the delivery is.
 */
export const updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body as { lat: number; lng: number };
  const result = await Order.updateMany(
    { rider: req.user!.id, status: 'out_for_delivery' },
    { $set: { riderLocation: { lat, lng, at: new Date() } } },
  );
  ok(res, { updated: result.modifiedCount });
});
