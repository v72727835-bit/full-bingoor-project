import { Types } from 'mongoose';
import { AdminAlert } from '../models/AdminAlert';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { loadSettings } from './settings.service';

/** A rider counts as online if the app talked to us within this window. */
export const ONLINE_WINDOW_MS = 2 * 60_000;

/** COD cash each rider has collected and not yet handed in, plus lifetime totals. */
export async function codSummary(riderIds?: Types.ObjectId[]) {
  const match: Record<string, unknown> = { status: 'delivered', paymentMethod: 'cod', rider: { $exists: true } };
  if (riderIds) match.rider = { $in: riderIds };
  const rows = await Order.aggregate<{ _id: Types.ObjectId; pending: number; total: number; deliveries: number }>([
    { $match: match },
    {
      $group: {
        _id: '$rider',
        total: { $sum: '$total' },
        pending: { $sum: { $cond: [{ $eq: ['$codSettled', true] }, 0, '$total'] } },
        deliveries: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

/**
 * Pauses a rider once their unsettled COD cash reaches the admin's limit, and
 * raises an alert on the admin dashboard bell. Called after each delivery.
 */
export async function autoPauseIfOverLimit(riderId: string): Promise<boolean> {
  const { settings } = await loadSettings();
  const limit = settings.riderCodLimit ?? 2000;
  if (!limit) return false;
  const pending = (await codSummary([new Types.ObjectId(riderId)])).get(riderId)?.pending ?? 0;
  if (pending < limit) return false;

  const rider = await User.findOneAndUpdate(
    { _id: riderId, riderPaused: { $ne: true } },
    { $set: { riderPaused: true, riderPausedAt: new Date() } },
    { new: true },
  )
    .select('name email phone')
    .lean();
  if (rider) {
    await AdminAlert.create({
      type: 'rider_paused',
      rider: rider._id,
      message: `${rider.name} (${rider.email ?? rider.phone}) was paused automatically: ₹${Math.round(pending)} COD not submitted.`,
    });
  }
  return true;
}
