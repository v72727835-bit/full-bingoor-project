import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { Shop } from '../models/Shop';
import { WalletTxn } from '../models/WalletTxn';
import { roadKm } from './roadDistance.service';
import { loadSettings } from './settings.service';

export interface RiderPayRules {
  enabled: boolean;
  baseFare: number;
  slabs: { maxKm: number; pay: number }[];
  perKmBeyond: number;
  minPerOrder: number;
  minWithdraw: number;
}

const DEFAULTS: RiderPayRules = { enabled: true, baseFare: 10, slabs: [{ maxKm: 2, pay: 15 }, { maxKm: 5, pay: 25 }, { maxKm: 10, pay: 40 }], perKmBeyond: 6, minPerOrder: 15, minWithdraw: 100 };

export function payRules(settings: { riderPay?: Partial<RiderPayRules> }): RiderPayRules {
  const p = settings.riderPay ?? {};
  return {
    enabled: p.enabled ?? DEFAULTS.enabled,
    baseFare: p.baseFare ?? DEFAULTS.baseFare,
    slabs: (p.slabs && p.slabs.length ? p.slabs : DEFAULTS.slabs).slice().sort((a, b) => a.maxKm - b.maxKm),
    perKmBeyond: p.perKmBeyond ?? DEFAULTS.perKmBeyond,
    minPerOrder: p.minPerOrder ?? DEFAULTS.minPerOrder,
    minWithdraw: p.minWithdraw ?? DEFAULTS.minWithdraw,
  };
}

/** What a run of `km` kilometres pays, given the rules. */
export function earningFor(km: number, rules: RiderPayRules): number {
  if (!rules.enabled) return 0;
  const slabs = rules.slabs;
  let slabPay = 0;
  const band = slabs.find((s) => km <= s.maxKm);
  if (band) slabPay = band.pay;
  else if (slabs.length) {
    const last = slabs[slabs.length - 1];
    slabPay = last.pay + Math.max(0, km - last.maxKm) * rules.perKmBeyond;
  } else {
    slabPay = km * rules.perKmBeyond;
  }
  const total = rules.baseFare + slabPay;
  return Math.max(rules.minPerOrder, Math.round(total));
}

/**
 * Credits a rider for a delivery they just completed: works out the distance
 * from the warehouse to the customer, applies the pay rules, saves the figure
 * on the order and adds an "earning" line to the rider's wallet.
 */
export async function creditDeliveryEarning(orderId: Types.ObjectId | string): Promise<number> {
  const order = await Order.findById(orderId).select('rider shop address riderEarning deliveredAt orderNumber tip distanceKm').lean();
  if (!order || !order.rider || (order.riderEarning ?? 0) > 0) return 0;
  const { settings } = await loadSettings();
  const rules = payRules(settings);
  if (!rules.enabled) return 0;

  // The rider is paid for the road: the km saved on the order at checkout, else worked out now (never a straight line).
  let km = order.distanceKm && order.distanceKm > 0 ? order.distanceKm : 0;
  const dest = order.address?.location;
  if (!km && dest?.lat && dest?.lng) {
    const shop = await Shop.findById(order.shop).select('location').lean();
    const c = shop?.location?.coordinates;
    if (c) km = await roadKm({ lat: dest.lat, lng: dest.lng }, { lat: c[1], lng: c[0] });
  }
  // The customer's tip (#35) goes to the rider in full, on top of the delivery pay.
  const tip = order.tip ?? 0;
  const amount = earningFor(km, rules) + tip;
  // Claim the earning on the order first; only the call that wins the claim pays.
  const claim = await Order.updateOne({ _id: order._id, riderEarning: { $in: [0, null] } }, { $set: { riderEarning: amount, riderEarningKm: Math.round(km * 10) / 10 } });
  if (!claim.modifiedCount) return 0;
  // The unique (order, earning) index is the second guard against a double credit.
  await WalletTxn.create({
    rider: order.rider,
    kind: 'earning',
    amount,
    status: 'completed',
    order: order._id,
    km: Math.round(km * 10) / 10,
    note: tip > 0 ? `Delivery #${order.orderNumber} (incl. ₹${tip} tip)` : `Delivery #${order.orderNumber}`,
  }).catch((e: { code?: number }) => {
    if (e?.code !== 11000) throw e;
  });
  return amount;
}

/**
 * A rider's money at a glance: what they have earned, what is still owed to
 * them (balance), and what is tied up in pending withdrawals.
 */
export async function walletSummary(riderId: Types.ObjectId | string) {
  const id = new Types.ObjectId(String(riderId));
  const rows = await WalletTxn.aggregate<{ _id: { kind: string; status: string }; total: number }>([
    { $match: { rider: id } },
    { $group: { _id: { kind: '$kind', status: '$status' }, total: { $sum: '$amount' } } },
  ]);
  let credit = 0; // earnings + bonus + positive adjustments
  let withdrawHeld = 0; // pending + paid withdrawals
  let pendingWithdraw = 0;
  for (const r of rows) {
    const { kind, status } = r._id;
    if (kind === 'earning' || kind === 'bonus' || kind === 'adjustment') credit += r.total;
    else if (kind === 'withdrawal' && (status === 'pending' || status === 'paid')) {
      withdrawHeld += r.total;
      if (status === 'pending') pendingWithdraw += r.total;
    }
  }
  const lifetimeEarned = credit;
  const balance = Math.max(0, credit - withdrawHeld);
  return { balance, lifetimeEarned, pendingWithdraw, withdrawnTotal: withdrawHeld - pendingWithdraw };
}

/** Per-day earnings for the last `days` days (Indian calendar), plus roll-ups. */
export async function earningsSeries(riderId: Types.ObjectId | string, days = 14) {
  const id = String(riderId);
  const span = Math.min(60, Math.max(7, days));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (span - 1));
  const rows = await WalletTxn.find({ rider: id, kind: { $in: ['earning', 'bonus'] }, createdAt: { $gte: since } })
    .select('kind amount createdAt')
    .lean();
  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const amountByDay = new Map<string, number>();
  const deliveriesByDay = new Map<string, number>();
  for (const r of rows) {
    const key = fmt(r.createdAt);
    amountByDay.set(key, (amountByDay.get(key) ?? 0) + r.amount);
    if (r.kind === 'earning') deliveriesByDay.set(key, (deliveriesByDay.get(key) ?? 0) + 1);
  }
  const series: { date: string; amount: number; deliveries: number }[] = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = fmt(d);
    series.push({ date: key, amount: amountByDay.get(key) ?? 0, deliveries: deliveriesByDay.get(key) ?? 0 });
  }
  const todayKey = fmt(new Date());
  const today = series.find((s) => s.date === todayKey)?.amount ?? 0;
  const week = series.slice(-7).reduce((a, s) => a + s.amount, 0);
  const month = series.reduce((a, s) => a + s.amount, 0);
  const deliveries = series.reduce((a, s) => a + s.deliveries, 0);
  return { series, today, week, month, deliveries };
}
