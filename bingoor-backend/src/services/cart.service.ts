import { Types } from 'mongoose';
import { env } from '../config/env';
import { Cart } from '../models/Cart';
import { IProduct, Product } from '../models/Product';
import { IShop } from '../models/Shop';
import { haversineKm, round2 } from '../utils/helpers';
import { User } from '../models/User';
import { pointsTarget } from './pricing.service';
import { loadSettings, productRules } from './settings.service';

export type ProductLean = IProduct & { _id: Types.ObjectId };
export type ShopLean = IShop & { _id: Types.ObjectId };

export interface ResolvedLine {
  product: ProductLean;
  quantity: number;
}

export interface ResolvedGroup {
  shop: ShopLean;
  lines: ResolvedLine[];
}

export function deliveryFeeFor(shop: Pick<IShop, 'deliveryFee'>, subtotal: number): number {
  return subtotal >= env.FREE_DELIVERY_ABOVE ? 0 : shop.deliveryFee;
}

/**
 * Loads the user's cart with live product + shop data, grouped by shop.
 * Products that no longer exist are dropped from the cart automatically.
 */
export async function resolveCart(userId: string): Promise<ResolvedGroup[]> {
  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart || cart.items.length === 0) return [];
  const { groups, missing } = await resolveItems(cart.items);
  if (missing.length) {
    await Cart.updateOne({ user: userId }, { $pull: { items: { product: { $in: missing } } } });
  }
  return groups;
}

/** Groups a list of {product, quantity} by shop with live product data; `missing` are ids that no longer exist. */
export async function resolveItems(items: { product: Types.ObjectId | string; quantity: number }[]): Promise<{ groups: ResolvedGroup[]; missing: Types.ObjectId[] }> {
  if (items.length === 0) return { groups: [], missing: [] };
  const products = (await Product.find({ _id: { $in: items.map((i) => i.product) } })
    .populate('shop')
    .lean()) as unknown as Array<Omit<ProductLean, 'shop'> & { shop: ShopLean | null }>;
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const groups = new Map<string, ResolvedGroup>();
  const missing: Types.ObjectId[] = [];

  for (const item of items) {
    const p = byId.get(String(item.product));
    if (!p || !p.shop) {
      missing.push(new Types.ObjectId(String(item.product)));
      continue;
    }
    const shop = p.shop;
    const key = String(shop._id);
    if (!groups.has(key)) groups.set(key, { shop, lines: [] });
    groups.get(key)!.lines.push({
      product: { ...p, shop: shop._id } as unknown as ProductLean,
      quantity: item.quantity,
    });
  }
  return { groups: [...groups.values()], missing };
}

export type LineIssue = 'unavailable' | 'out_of_stock' | 'insufficient_stock';

export function lineIssue(group: ResolvedGroup, line: ResolvedLine): LineIssue | null {
  if (!group.shop.isActive || !line.product.isActive) return 'unavailable';
  if (line.product.stock <= 0) return 'out_of_stock';
  if (line.product.stock < line.quantity) return 'insufficient_stock';
  return null;
}

/** Shapes resolved groups into the JSON the app renders. */
export function buildCartView(groups: ResolvedGroup[]) {
  let itemCount = 0;
  let subtotal = 0;
  let deliveryFee = 0;
  let hasIssues = false;

  const viewGroups = groups.map((g) => {
    let groupSubtotal = 0;
    const items = g.lines.map((l) => {
      const issue = lineIssue(g, l);
      const lineTotal = round2(l.product.price * l.quantity);
      if (issue) hasIssues = true;
      else groupSubtotal += lineTotal;
      itemCount += l.quantity;
      return {
        productId: l.product._id,
        name: l.product.name,
        nameHi: l.product.nameHi,
        slug: l.product.slug,
        image: l.product.images[0] ?? null,
        icon: l.product.icon,
        unit: l.product.unit,
        price: l.product.price,
        mrp: l.product.mrp,
        quantity: l.quantity,
        lineTotal,
        stock: l.product.stock,
        ...productRules(l.product.category, l.product.paymentMode),
        issue,
      };
    });

    groupSubtotal = round2(groupSubtotal);
    const fee = groupSubtotal > 0 ? deliveryFeeFor(g.shop, groupSubtotal) : 0;
    // No per-warehouse minimum: the customer shops one store and the minimum order is
    // judged on the whole basket (/cart/quote, quoteCart). A warehouse is never named.
    const meetsMinOrder = true;
    if (!g.shop.isOpen) hasIssues = true;
    subtotal += groupSubtotal;
    deliveryFee += fee;

    return {
      shop: {
        id: g.shop._id,
        name: g.shop.name,
        slug: g.shop.slug,
        logo: g.shop.logo ?? null,
        isOpen: g.shop.isOpen,
        minOrderAmount: g.shop.minOrderAmount,
      },
      items,
      subtotal: groupSubtotal,
      deliveryFee: fee,
      total: round2(groupSubtotal + fee),
      meetsMinOrder,
    };
  });

  return {
    groups: viewGroups,
    itemCount,
    subtotal: round2(subtotal),
    deliveryFee: round2(deliveryFee),
    total: round2(subtotal + deliveryFee),
    hasIssues,
    freeDeliveryAbove: env.FREE_DELIVERY_ABOVE,
  };
}

/** Hidden cart-points total for the basket (valid lines only). */
export function cartPointsTotal(groups: ResolvedGroup[]): number {
  let total = 0;
  for (const g of groups) for (const l of g.lines) if (!lineIssue(g, l)) total += (l.product.points ?? 0) * l.quantity;
  return total;
}

/**
 * The cart-points rule. Customers never see the numbers - only whether
 * checkout is open (`met`), a row of top-up products, and the one product
 * that is added for them when they are short.
 */
/** The delivery distance a basket is judged on: the farthest warehouse in it from the point. */
export function basketKm(groups: ResolvedGroup[], point?: { lat?: number; lng?: number } | null): number | null {
  if (!point?.lat || !point?.lng) return null;
  const kms = groups
    .map((g) => g.shop.location?.coordinates)
    .filter((c): c is [number, number] => !!c && c.length >= 2)
    .map((c) => haversineKm(point.lat!, point.lng!, c[1], c[0]));
  return kms.length ? Math.max(...kms) : null;
}

async function pointsView(groups: ResolvedGroup[], distanceKm: number | null = null) {
  const { settings } = await loadSettings();
  const rule = settings.cartPoints;
  // The points needed depend on how far the customer is (see pointsTarget).
  const target = pointsTarget(settings, distanceKm);
  if (!rule?.enabled || target <= 0) return { enabled: !!rule?.enabled, met: true, suggestions: [], autoAddId: null };

  const inCart = new Set(groups.flatMap((g) => g.lines.map((l) => String(l.product._id))));
  const total = cartPointsTotal(groups);
  const needed = Math.max(0, target - total);
  if (needed === 0) return { enabled: true, met: true, suggestions: [], autoAddId: null };

  // The top-up pool = products the admin ticked on the product form
  // (cartFeatured), plus any picked in the global Delivery & Pricing list (#35).
  const pool = (await Product.find({
    isActive: true,
    stock: { $gt: 0 },
    $or: [{ cartFeatured: true }, { _id: { $in: rule.suggestions ?? [] } }],
  })
    .select('name slug images icon unit price mrp points stock sortCode category shop')
    .lean()) as unknown as (Pick<IProduct, 'name' | 'slug' | 'images' | 'icon' | 'unit' | 'price' | 'mrp' | 'points' | 'stock' | 'sortCode' | 'category' | 'shop'> & { _id: Types.ObjectId })[];
  // Only from the warehouses already in the basket: a top-up from another
  // warehouse becomes a separate delivery with its own minimum order, which
  // blocked checkout (it showed "add ₹-113 more").
  const cartShops = new Set(groups.map((g) => String(g.shop._id)));
  const notInCart = pool.filter((p) => !inCart.has(String(p._id)) && p.points > 0);
  const sameShop = notInCart.filter((p) => cartShops.has(String(p.shop)));
  const usable = sameShop.length ? sameShop : notInCart;

  const closes = (p: (typeof usable)[number]) => p.points >= needed;
  // A different product each time, from every product that closes the gap - the
  // client saw the same two again and again when it was always the cheapest one.
  const anyOf = (list: typeof usable) => (list.length ? list[Math.floor(Math.random() * list.length)] : undefined);
  const pick = anyOf(usable.filter(closes)) ?? [...usable].sort((a, b) => b.points - a.points)[0];
  return {
    enabled: true,
    met: false,
    autoAddId: pick ? String(pick._id) : null,
    // The admin's sort code decides the order of the rows under the cart.
    suggestions: usable
      .sort((a, b) => (a.sortCode ?? 1_000_000) - (b.sortCode ?? 1_000_000) || a.price - b.price)
      .slice(0, 36)
      .map((p) => ({
        productId: p._id,
        name: p.name,
        slug: p.slug,
        image: p.images?.[0] ?? null,
        icon: p.icon,
        unit: p.unit,
        price: p.price,
        mrp: p.mrp,
      })),
  };
}

export async function getCartView(userId: string, point?: { lat?: number; lng?: number } | null) {
  const groups = await resolveCart(userId);
  // Without a point from the app, judge the distance from the customer's default address.
  let at = point;
  if (!at?.lat || !at?.lng) {
    const user = await User.findById(userId).select('addresses').lean();
    const def = user?.addresses?.find((a) => a.isDefault) ?? user?.addresses?.[0];
    at = def?.location ?? null;
  }
  return { ...buildCartView(groups), points: await pointsView(groups, basketKm(groups, at)) };
}

/** The same view for a visitor who has not signed in yet: their basket lives in the browser / phone. */
export async function guestCartView(items: { product: string; quantity: number }[], point?: { lat: number; lng: number }) {
  const { groups } = await resolveItems(items);
  return { groups, view: { ...buildCartView(groups), points: await pointsView(groups, basketKm(groups, point)) } };
}

/** #35 "See all": every product the admin picked for the cart rows, in sort-code order. */
export async function pointsProductIds(): Promise<Types.ObjectId[]> {
  const { settings } = await loadSettings();
  if (!settings.cartPoints?.enabled) return [];
  const rows = await Product.find({
    isActive: true,
    stock: { $gt: 0 },
    points: { $gt: 0 },
    $or: [{ cartFeatured: true }, { _id: { $in: settings.cartPoints.suggestions ?? [] } }],
  })
    .sort({ sortCode: 1, name: 1 })
    .select('_id')
    .lean();
  return rows.map((r) => r._id as Types.ObjectId);
}
