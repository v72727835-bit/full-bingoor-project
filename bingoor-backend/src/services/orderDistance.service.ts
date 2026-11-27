import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { Shop } from '../models/Shop';
import { roadLegs } from './roadDistance.service';


/** Marks a saved km as the shortest road route (version 1 = a straight line, unmarked/road-fastest = measured again). */
export const ROUTE_VERSION = 2;

/**
 * The km of an order, BY ROAD, from the warehouse to the delivery pin. Orders placed while distances were
 * still straight lines carry that old km: the first time it is needed it is measured by road and saved, so
 * the rider's pay and every screen agree with the map. If the road service cannot answer, an estimate is
 * used for now (never saved, so the real road is asked for next time). Null when the pins are unknown.
 */
export async function ensureRoadKm(orderId: Types.ObjectId | string): Promise<number | null> {
  const order = await Order.findById(orderId).select('shop address distanceKm distanceV').lean();
  if (!order) return null;
  if (order.distanceV === ROUTE_VERSION && order.distanceKm) return order.distanceKm;
  const dest = order.address?.location;
  const shop = await Shop.findById(order.shop).select('location').lean();
  const c = shop?.location?.coordinates;
  if (!dest?.lat || !dest?.lng || !c || c.length < 2) return order.distanceKm ?? null;
  const [leg] = await roadLegs({ lat: dest.lat, lng: dest.lng }, [{ lat: c[1], lng: c[0] }]);
  if (leg.road) await Order.updateOne({ _id: order._id }, { $set: { distanceKm: leg.km, distanceRoad: true, distanceV: ROUTE_VERSION } });
  return leg.km;
}
