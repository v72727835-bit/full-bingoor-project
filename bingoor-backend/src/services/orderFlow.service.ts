import { Types } from 'mongoose';
import { IOrder, Order } from '../models/Order';
import { Product } from '../models/Product';
import { riderWarehouseIds, User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { ONLINE_WINDOW_MS } from './rider.service';
import { createShiprocketOrder } from './shiprocket.service';
import { creditSellerEarnings } from './sellerPay.service';

/**
 * Where the store side (admin or seller) may move an order next. A rider
 * either accepts a ready order in the app or the store assigns one; either
 * puts it out for delivery. Closed orders never reopen.
 */
export const STORE_TRANSITIONS: Record<string, IOrder['status'][]> = {
  placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
};

export async function moveOrderStatus(orderId: string, status: IOrder['status'], note: string | undefined, by: 'admin' | 'shop') {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const allowed = STORE_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    const options = allowed.length ? allowed.join(', ').replace(/_/g, ' ') : 'nothing - it is closed';
    throw new ApiError(409, `Cannot move a ${order.status.replace(/_/g, ' ')} order to ${status.replace(/_/g, ' ')}. Allowed: ${options}`);
  }
  // Claim the change atomically so a rider accepting at the same moment can't be overwritten.
  const ending = status === 'cancelled' || status === 'rejected';
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: { status, ...(status === 'delivered' ? { deliveredAt: new Date() } : {}), ...(ending ? { cancelledBy: by } : {}) },
      $push: { statusHistory: { status, at: new Date(), note } },
    },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'This order changed a moment ago. Refresh and try again.');
  // Cancelled or rejected stock goes back on the shelf.
  if (ending) {
    await Promise.all(updated.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity, soldCount: -i.quantity } })));
  }
  // A store-side delivery (e.g. a Shiprocket order marked delivered) still earns the sellers their share.
  if (status === 'delivered') await creditSellerEarnings(updated._id).catch(() => undefined);
  return updated;
}

const ASSIGNABLE: IOrder['status'][] = ['accepted', 'preparing', 'ready_for_pickup'];

/** Riders of the order's warehouse who are online, not paused and not carrying a delivery. */
export async function freeRidersForOrder(orderId: string) {
  const order = await Order.findById(orderId).select('shop longDistance status rider').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const busy = await Order.distinct('rider', { status: 'out_for_delivery', rider: { $exists: true } });
  return User.find({
    role: 'rider',
    isActive: true,
    // Riders can serve several warehouses; `warehouse` is only their first one.
    $or: [{ warehouse: order.shop }, { warehouses: order.shop }],
    riderPaused: { $ne: true },
    lastSeenAt: { $gte: since },
    _id: { $nin: busy },
    ...(order.longDistance ? { riderLongDistance: true } : { riderLongDistance: { $ne: true } }),
  })
    .select('name phone riderLongDistance lastSeenAt')
    .sort({ name: 1 })
    .lean();
}

/**
 * Every rider of the order's warehouse with their state right now, so the panel can show who is free
 * (assignable) and why the others are not. Riders belong to the warehouse the order is served from,
 * so these are the riders working within that warehouse's delivery radius.
 */
export async function ridersForOrder(orderId: string) {
  const order = await Order.findById(orderId).select('shop longDistance distanceKm').populate('shop', 'name deliveryRadiusKm').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  const shop = order.shop as unknown as { _id: Types.ObjectId; name: string; deliveryRadiusKm?: number };
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [riders, busy] = await Promise.all([
    User.find({ role: 'rider', isActive: true, $or: [{ warehouse: shop._id }, { warehouses: shop._id }] }).select('name phone riderLongDistance riderPaused lastSeenAt').sort({ name: 1 }).lean(),
    Order.distinct('rider', { status: 'out_for_delivery', rider: { $exists: true } }),
  ]);
  const busyIds = new Set(busy.map(String));
  const rows = riders.map((r) => {
    const online = !!r.lastSeenAt && r.lastSeenAt >= since;
    const laneOk = order.longDistance ? !!r.riderLongDistance : !r.riderLongDistance;
    const state = r.riderPaused ? 'paused' : !online ? 'offline' : busyIds.has(String(r._id)) ? 'busy' : !laneOk ? (order.longDistance ? 'not_long_distance' : 'long_distance_only') : 'free';
    return { _id: r._id, name: r.name, phone: r.phone, lastSeenAt: r.lastSeenAt, state, free: state === 'free' };
  });
  const rank = { free: 0, busy: 1, offline: 2, paused: 3, long_distance_only: 4, not_long_distance: 4 } as Record<string, number>;
  rows.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name));
  return { warehouse: shop.name, radiusKm: shop.deliveryRadiusKm ?? null, distanceKm: order.distanceKm ?? null, longDistance: !!order.longDistance, riders: rows };
}

export async function assignRiderToOrder(orderId: string, riderId: string, by: string) {
  const order = await Order.findById(orderId).select('shop longDistance status rider').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.rider) throw new ApiError(409, 'A rider is already assigned to this order.');
  if (!ASSIGNABLE.includes(order.status)) throw new ApiError(409, 'Accept the order first, then assign a rider.');
  const free = await freeRidersForOrder(orderId);
  const rider = free.find((r) => String(r._id) === riderId);
  if (!rider) throw new ApiError(409, 'That rider is not free right now. Pick another rider.');
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status, rider: { $exists: false } },
    { $set: { rider: new Types.ObjectId(riderId), status: 'out_for_delivery' }, $push: { statusHistory: { status: 'out_for_delivery', at: new Date(), note: `Assigned to ${rider.name} by ${by}` } } },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'This order changed a moment ago. Refresh and try again.');
  return updated;
}

/**
 * Hand an accepted order to the Shiprocket courier network instead of a rider.
 * We create the order in Shiprocket first, and only then mark it out for
 * delivery, so a Shiprocket failure never leaves our order in a wrong state.
 */
export async function assignToShiprocket(orderId: string, by: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.rider) throw new ApiError(409, 'A rider is already assigned to this order.');
  if (order.fulfillment === 'shiprocket' && order.shiprocket?.orderId) throw new ApiError(409, 'This order is already sent to Shiprocket.');
  if (!ASSIGNABLE.includes(order.status)) throw new ApiError(409, 'Accept the order first, then send it to Shiprocket.');
  const sr = await createShiprocketOrder(order);
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, rider: { $exists: false }, status: order.status },
    {
      $set: { fulfillment: 'shiprocket', status: 'out_for_delivery', shiprocket: { ...sr, syncedAt: new Date() } },
      $push: { statusHistory: { status: 'out_for_delivery', at: new Date(), note: `Sent to Shiprocket by ${by}${sr.awb ? ` · AWB ${sr.awb}` : ''}${sr.courier ? ` · ${sr.courier}` : ''}` } },
    },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'This order changed a moment ago. Refresh and try again.');
  return updated;
}

const WAITING_FOR_RIDER = ['accepted', 'preparing', 'ready_for_pickup'];

/**
 * For each order still waiting for a rider: how many riders can see it in their app right now.
 * Uses the same warehouse and long-distance rules as the rider app, so "0" explains a missing order.
 */
export async function withRiderPool<T extends { shop?: unknown; rider?: unknown; status: string; fulfillment?: string; longDistance?: boolean }>(orders: T[]) {
  const waiting = orders.filter((o) => !o.rider && o.fulfillment !== 'shiprocket' && WAITING_FOR_RIDER.includes(o.status));
  if (!waiting.length) return orders;
  const shopId = (o: T) => String((o.shop as { _id?: unknown } | null)?._id ?? o.shop);
  const shopIds = [...new Set(waiting.map(shopId))];
  const riders = await User.find({
    role: 'rider',
    isActive: true,
    deletedAt: { $exists: false },
    $or: [{ warehouse: { $in: shopIds } }, { warehouses: { $in: shopIds } }],
  })
    .select('warehouse warehouses riderPaused riderLongDistance lastSeenAt')
    .lean();
  const since = Date.now() - ONLINE_WINDOW_MS;
  return orders.map((o) => {
    if (!waiting.includes(o)) return o;
    const linked = riders.filter((r) => riderWarehouseIds(r).some((w) => String(w) === shopId(o)));
    const canSee = linked.filter((r) => !r.riderPaused && !!r.riderLongDistance === !!o.longDistance);
    const online = canSee.filter((r) => r.lastSeenAt && r.lastSeenAt.getTime() >= since);
    return { ...o, riderPool: { linked: linked.length, canSee: canSee.length, online: online.length } };
  });
}
