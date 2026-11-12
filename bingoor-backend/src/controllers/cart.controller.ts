import { Types } from 'mongoose';
import { Cart, MAX_QTY_PER_ITEM } from '../models/Cart';
import { Product } from '../models/Product';
import { Shop } from '../models/Shop';
import { User } from '../models/User';
import { getCartView, guestCartView, lineIssue, resolveCart, ResolvedGroup } from '../services/cart.service';
import { orderDeliveryDays, paymentFee, paymentOptions, quoteCart, Slot } from '../services/pricing.service';
import { codMessage, loadSettings, longDistanceCodMessage, productRules } from '../services/settings.service';
import { haversineKm, round2 } from '../utils/helpers';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const getCart = asyncHandler(async (req, res) => {
  ok(res, await getCartView(req.user!.id));
});

export const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body as { productId: string; quantity: number };
  const userId = req.user!.id;

  const product = await Product.findOne({ _id: productId, isActive: true }).select('stock shop').lean();
  if (!product) throw new ApiError(404, 'Product not found');
  if (!(await Shop.exists({ _id: product.shop, isActive: true }))) throw new ApiError(404, 'This shop is not available');
  if (product.stock <= 0) throw new ApiError(409, 'This product is out of stock');

  const limit = Math.min(MAX_QTY_PER_ITEM, product.stock);

  // ISSUE-14: add atomically so two quick taps can't overwrite each other (the
  // old load-modify-save pattern lost one of the increments). The pipeline bumps
  // an existing line (clamped to `limit`) or appends a new one, all in one op.
  // `new: false` returns the pre-image so we can still tell the user when their
  // requested quantity was clamped to available stock.
  const before = await Cart.findOneAndUpdate(
    { user: userId },
    [
      {
        $set: {
          items: {
            $let: {
              vars: { items: { $ifNull: ['$items', []] } },
              in: {
                $cond: [
                  { $in: [product._id, { $map: { input: '$$items', in: '$$this.product' } }] },
                  {
                    $map: {
                      input: '$$items',
                      in: {
                        $cond: [
                          { $eq: ['$$this.product', product._id] },
                          { product: '$$this.product', quantity: { $min: [{ $add: ['$$this.quantity', quantity] }, limit] } },
                          '$$this',
                        ],
                      },
                    },
                  },
                  { $concatArrays: ['$$items', [{ product: product._id, quantity: { $min: [quantity, limit] } }]] },
                ],
              },
            },
          },
        },
      },
    ],
    { upsert: true, new: false },
  );

  const prevQty = before?.items.find((i) => String(i.product) === productId)?.quantity ?? 0;
  const wanted = prevQty + quantity;
  const finalQty = Math.min(wanted, limit);

  const view = await getCartView(userId);
  ok(res, { ...view, ...(finalQty < wanted ? { notice: `Only ${finalQty} available - quantity adjusted` } : {}) });
});

export const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body as { quantity: number };
  const userId = req.user!.id;

  if (quantity === 0) {
    const r = await Cart.updateOne({ user: userId }, { $pull: { items: { product: productId } } });
    if (!r.modifiedCount) throw new ApiError(404, 'Item is not in your cart');
  } else {
    const product = await Product.findOne({ _id: productId, isActive: true }).select('stock').lean();
    if (!product || product.stock <= 0) throw new ApiError(409, 'This product is no longer available');
    const qty = Math.min(quantity, MAX_QTY_PER_ITEM, product.stock);
    // Atomic positional set so a concurrent add/update can't clobber the line.
    const r = await Cart.updateOne(
      { user: userId, 'items.product': productId },
      { $set: { 'items.$[el].quantity': qty } },
      { arrayFilters: [{ 'el.product': new Types.ObjectId(productId) }] },
    );
    if (!r.matchedCount) throw new ApiError(404, 'Item is not in your cart');
  }
  ok(res, await getCartView(userId));
});

export const removeItem = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user!.id }, { $pull: { items: { product: req.params.productId } } });
  ok(res, await getCartView(req.user!.id));
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user!.id }, { $set: { items: [] } });
  ok(res, await getCartView(req.user!.id));
});

/**
 * What this basket costs to deliver to an address: handling fee, delivery fee
 * (waived once the distance band's free amount is reached), the 2 hour charge
 * and whether COD is open - all from the admin's pricing rules.
 */
export const quote = asyncHandler(async (req, res) => {
  const { addressId, lat, lng, slot } = req.query as unknown as { addressId?: string; lat?: number; lng?: number; slot: Slot };
  const groups = await resolveCart(req.user!.id);

  // The address's own map pin wins; without one, the customer's current
  // location (sent as lat/lng) decides the distance band and delivery time.
  let point: { lat: number; lng: number } | undefined;
  if (addressId) {
    const user = await User.findById(req.user!.id).select('addresses').lean();
    const a = user?.addresses?.find((x) => String(x._id) === addressId);
    if (a?.location?.lat && a.location.lng) point = { lat: a.location.lat, lng: a.location.lng };
  }
  if (!point && lat !== undefined && lng !== undefined) point = { lat, lng };
  ok(res, await quoteFor(groups, point, slot));
});

async function quoteFor(groups: ResolvedGroup[], point: { lat: number; lng: number } | undefined, slot: Slot) {
  const { settings } = await loadSettings();

  // One basket, one set of rules: the customer never sees which warehouse fills
  // which item, so the minimum order, free delivery and fees are judged on the
  // whole cart (checkout, runPlaceOrder, uses the same quoteCart).
  const legs = groups.map((g) => {
    const subtotal = g.lines.reduce((s, l) => (lineIssue(g, l) ? s : s + l.product.price * l.quantity), 0);
    const c = g.shop.location?.coordinates;
    const km = point && c ? haversineKm(point.lat, point.lng, c[1], c[0]) : null;
    return { subtotal, distanceKm: km };
  });
  const q = quoteCart(settings, { groups: legs, slot });
  const { subtotal, handlingFee, deliveryFee, twoHourFee, total, distanceKm, redOrder, longDistance, addForFree, freeAbove, minOrder, meetsMinOrder, baseDeliveryFee } = q;
  // #31: the cart's ETA must also honour a category's fixed "6 day" delivery,
  // exactly like the placed order does: a 6-day aisle only slows an order that
  // holds nothing but 6-day aisles; mixed with other items the location decides.
  const days = groups.reduce((d, g) => {
    const lineDays = g.lines.map((l) => productRules(l.product.category).deliveryDays ?? 0);
    return Math.max(d, orderDeliveryDays(q.days, lineDays));
  }, 0);

  // Two separate reasons COD can be off: something in the basket, or the
  // customer being past the last distance band. Distance is reported first,
  // since it is the one they cannot fix by editing their cart.
  const distanceCodAllowed = q.codAllowed;
  const productsAllowCod = groups.every((g) =>
    g.lines.every((l) => productRules(l.product.category, l.product.paymentMode).codAvailable),
  );
  const codAllowed = distanceCodAllowed && productsAllowCod;
  const message = !distanceCodAllowed ? longDistanceCodMessage() : productsAllowCod ? undefined : codMessage();
  // #36: what each way to pay would add to this bill, so checkout can show it next to the option.
  const paymentFees = Object.fromEntries(paymentOptions(settings).map((o) => [o.key, paymentFee(settings, o.key, total)]));
  return {
    distanceKm,
    subtotal,
    minOrder,
    meetsMinOrder,
    handlingFee,
    baseDeliveryFee,
    deliveryFee,
    freeAbove,
    addForFree,
    twoHourFee,
    days,
    redOrder,
    longDistance,
    codAllowed,
    total,
    paymentFees,
    ...(message ? { codMessage: message } : {}),
  };
}

/**
 * A visitor's basket before they sign in (#23): the items live in their browser
 * or phone and are priced here exactly like a saved cart, with the delivery
 * quote for their chosen location. Nothing is stored.
 */
export const guestCart = asyncHandler(async (req, res) => {
  const { items, lat, lng, slot } = req.body as { items: { productId: string; quantity: number }[]; lat?: number; lng?: number; slot: Slot };
  // The same product twice adds up, and each line is capped like a real cart.
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.productId, Math.min(MAX_QTY_PER_ITEM, (merged.get(i.productId) ?? 0) + i.quantity));
  const { groups, view } = await guestCartView([...merged].map(([product, quantity]) => ({ product, quantity })));
  const point = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  ok(res, { ...view, quote: await quoteFor(groups, point, slot) });
});

