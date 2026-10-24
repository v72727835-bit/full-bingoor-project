import { Cart, MAX_QTY_PER_ITEM } from '../models/Cart';
import { Product } from '../models/Product';
import { Shop } from '../models/Shop';
import { User } from '../models/User';
import { getCartView, lineIssue, resolveCart } from '../services/cart.service';
import { quoteDelivery, Slot } from '../services/pricing.service';
import { codMessage, loadSettings, longDistanceCodMessage, productRules } from '../services/settings.service';
import { haversineKm } from '../utils/helpers';
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

  const cart = await Cart.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, new: true });

  const limit = Math.min(MAX_QTY_PER_ITEM, product.stock);
  const existing = cart.items.find((i) => String(i.product) === productId);
  const wanted = (existing?.quantity ?? 0) + quantity;
  const finalQty = Math.min(wanted, limit);

  if (existing) existing.quantity = finalQty;
  else cart.items.push({ product: product._id, quantity: finalQty });
  await cart.save();

  const view = await getCartView(userId);
  ok(res, { ...view, ...(finalQty < wanted ? { notice: `Only ${finalQty} available - quantity adjusted` } : {}) });
});

export const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body as { quantity: number };
  const userId = req.user!.id;

  const cart = await Cart.findOne({ user: userId });
  const item = cart?.items.find((i) => String(i.product) === productId);
  if (!cart || !item) throw new ApiError(404, 'Item is not in your cart');

  if (quantity === 0) {
    cart.items = cart.items.filter((i) => String(i.product) !== productId);
  } else {
    const product = await Product.findOne({ _id: productId, isActive: true }).select('stock').lean();
    if (!product || product.stock <= 0) throw new ApiError(409, 'This product is no longer available');
    item.quantity = Math.min(quantity, MAX_QTY_PER_ITEM, product.stock);
  }
  await cart.save();
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

  let subtotal = 0;
  for (const g of groups) for (const l of g.lines) if (!lineIssue(g, l)) subtotal += l.product.price * l.quantity;

  let point = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  if (!point && addressId) {
    const user = await User.findById(req.user!.id).select('addresses').lean();
    const a = user?.addresses?.find((x) => String(x._id) === addressId);
    if (a?.location?.lat && a.location.lng) point = { lat: a.location.lat, lng: a.location.lng };
  }
  const c = groups[0]?.shop.location?.coordinates;
  const km = point && c ? haversineKm(point.lat, point.lng, c[1], c[0]) : null;

  const { settings } = await loadSettings();
  const quote = quoteDelivery(settings, { subtotal, distanceKm: km, slot });
  // Two separate reasons COD can be off: something in the basket, or the
  // customer being past the last distance band. Distance is reported first,
  // since it is the one they cannot fix by editing their cart.
  const productsAllowCod = groups.every((g) =>
    g.lines.every((l) => productRules(l.product.category, l.product.paymentMode).codAvailable),
  );
  const codAllowed = quote.codAllowed && productsAllowCod;
  const message = !quote.codAllowed ? longDistanceCodMessage() : productsAllowCod ? undefined : codMessage();
  ok(res, { ...quote, codAllowed, ...(message ? { codMessage: message } : {}) });
});
