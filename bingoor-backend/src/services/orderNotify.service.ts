import { User } from '../models/User';
import { pushToUsers } from './firebase.service';

/**
 * Push messages for the order journey. Everything here is fire-and-forget:
 * a push that fails (or Firebase not being set up) never affects the order.
 */

interface OrderLike {
  _id: unknown;
  orderNumber?: string;
  user?: unknown;
  shop?: unknown;
  rider?: unknown;
  longDistance?: boolean;
  status?: string;
  paymentMethod?: string;
  total?: number;
}

const idOf = (v: unknown): string => {
  const o = v as { _id?: unknown } | null;
  return String(o && typeof o === 'object' && '_id' in o && o._id ? o._id : v);
};
const num = (o: OrderLike) => (o.orderNumber ? `#${o.orderNumber}` : '');
const data = (o: OrderLike, type: string, app: 'customer' | 'rider' | 'admin' = 'customer') => ({
  type,
  orderId: String(o._id),
  url: app === 'customer' ? `/orders/${String(o._id)}` : '/',
});

const fire = (p: Promise<unknown>) => void p.catch(() => undefined);

/** Riders of the order's warehouse who could take it (right lane, not paused). */
async function warehouseRiders(o: OrderLike): Promise<string[]> {
  const riders = await User.find({
    role: 'rider',
    isActive: true,
    $or: [{ warehouse: idOf(o.shop) }, { warehouses: idOf(o.shop) }],
    riderPaused: { $ne: true },
    ...(o.longDistance ? { riderLongDistance: true } : { riderLongDistance: { $ne: true } }),
  })
    .select('_id')
    .lean();
  return riders.map((r) => String(r._id));
}

const CUSTOMER_TEXT: Record<string, [string, string]> = {
  accepted: ['Order accepted', 'is accepted and will be packed shortly.'],
  preparing: ['Packing your order', 'is being packed.'],
  ready_for_pickup: ['Order packed', 'is packed and waiting for a delivery partner.'],
  out_for_delivery: ['Out for delivery', 'is on its way. Track it live in the app.'],
  delivered: ['Delivered', 'was delivered. Enjoy! Please rate your items.'],
  cancelled: ['Order cancelled', 'was cancelled.'],
  rejected: ['Order could not be accepted', 'could not be accepted by the store. Any payment will be refunded.'],
};

/** A new order: the customer, the warehouse's sellers and every admin. */
export function notifyOrderPlaced(o: OrderLike, paid: boolean) {
  fire(
    (async () => {
      await pushToUsers([idOf(o.user)], {
        title: paid ? 'Payment successful' : 'Order placed',
        body: paid ? `We received your payment. Order ${num(o)} is confirmed.` : `Order ${num(o)} is placed. We will confirm it shortly.`,
        data: data(o, paid ? 'payment_success' : 'order_placed'),
      });
      const staff = await User.find({
        isActive: true,
        $or: [{ role: 'admin' }, { role: 'seller', sellerWarehouses: idOf(o.shop) }],
      })
        .select('_id')
        .lean();
      await pushToUsers(staff.map((s) => String(s._id)), {
        title: 'New order',
        body: `Order ${num(o)} for ₹${o.total ?? ''} just came in.`,
        data: data(o, 'new_order', 'admin'),
      });
    })(),
  );
}

/** Any status change: tells the customer, and the riders when it becomes ready for pickup. */
export function notifyOrderStatus(o: OrderLike, status: string) {
  fire(
    (async () => {
      const t = CUSTOMER_TEXT[status];
      if (t) await pushToUsers([idOf(o.user)], { title: t[0], body: `Order ${num(o)} ${t[1]}`, data: data(o, `order_${status}`) });
      if (status === 'accepted') await notifyRidersUpcoming(o);
      if (status === 'ready_for_pickup') await notifyRidersPickup(o);
      if (status === 'cancelled' && o.rider) {
        await pushToUsers([idOf(o.rider)], { title: 'Order cancelled', body: `Order ${num(o)} was cancelled.`, data: data(o, 'order_cancelled', 'rider') });
      }
    })(),
  );
}

/** An order is waiting for pickup: all eligible riders of that warehouse. */
export async function notifyRidersPickup(o: OrderLike) {
  await pushToUsers(await warehouseRiders(o), {
    title: 'New delivery available',
    body: `Order ${num(o)} is ready for pickup. Open the app to accept it.`,
    data: data(o, 'pickup_available', 'rider'),
  });
}

/** The warehouse accepted an order: its riders see it in the app while it is packed. */
async function notifyRidersUpcoming(o: OrderLike) {
  await pushToUsers(await warehouseRiders(o), {
    title: 'New order coming',
    body: `Order ${num(o)} is being packed. You can accept it once it is ready for pickup.`,
    data: data(o, 'pickup_upcoming', 'rider'),
  });
}

/** A rider was given (or took) the order. */
export function notifyRiderAssigned(o: OrderLike, byStore: boolean) {
  fire(
    (async () => {
      if (byStore && o.rider) {
        await pushToUsers([idOf(o.rider)], { title: 'Delivery assigned to you', body: `Order ${num(o)} is yours. Pick it up now.`, data: data(o, 'rider_assigned', 'rider') });
      }
      await notifyOrderStatus(o, 'out_for_delivery');
    })(),
  );
}

/** The rider dropped the delivery: back to the pickup queue. */
export function notifyBackToPickup(o: OrderLike) {
  fire(notifyRidersPickup(o));
}
