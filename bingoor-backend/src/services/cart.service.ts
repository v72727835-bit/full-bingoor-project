import { Types } from 'mongoose';
import { env } from '../config/env';
import { Cart } from '../models/Cart';
import { IProduct, Product } from '../models/Product';
import { IShop } from '../models/Shop';
import { round2 } from '../utils/helpers';
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

  const products = (await Product.find({ _id: { $in: cart.items.map((i) => i.product) } })
    .populate('shop')
    .lean()) as unknown as Array<Omit<ProductLean, 'shop'> & { shop: ShopLean | null }>;
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const groups = new Map<string, ResolvedGroup>();
  const missing: Types.ObjectId[] = [];

  for (const item of cart.items) {
    const p = byId.get(String(item.product));
    if (!p || !p.shop) {
      missing.push(item.product);
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

  if (missing.length) {
    await Cart.updateOne({ user: userId }, { $pull: { items: { product: { $in: missing } } } });
  }
  return [...groups.values()];
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
    const meetsMinOrder = groupSubtotal >= g.shop.minOrderAmount;
    if (!meetsMinOrder || !g.shop.isOpen) hasIssues = true;
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
async function pointsView(groups: ResolvedGroup[]) {
  const { settings } = await loadSettings();
  const rule = settings.cartPoints;
  if (!rule?.enabled) return { enabled: false, met: true, suggestions: [], autoAddId: null };

  const inCart = new Set(groups.flatMap((g) => g.lines.map((l) => String(l.product._id))));
  const total = cartPointsTotal(groups);
  const needed = Math.max(0, rule.target - total);
  if (needed === 0) return { enabled: true, met: true, suggestions: [], autoAddId: null };

  const pool = (await Product.find({ _id: { $in: rule.suggestions ?? [] }, isActive: true, stock: { $gt: 0 } })
    .select('name slug images icon unit price mrp points stock')
    .lean()) as unknown as (Pick<IProduct, 'name' | 'slug' | 'images' | 'icon' | 'unit' | 'price' | 'mrp' | 'points' | 'stock'> & { _id: Types.ObjectId })[];
  const usable = pool.filter((p) => !inCart.has(String(p._id)) && p.points > 0);
  // The cheapest single product that closes the gap; otherwise the biggest one we have.
  const enough = usable.filter((p) => p.points >= needed).sort((a, b) => a.price - b.price)[0];
  const pick = enough ?? [...usable].sort((a, b) => b.points - a.points)[0];
  return {
    enabled: true,
    met: false,
    autoAddId: pick ? String(pick._id) : null,
    suggestions: usable
      .sort((a, b) => Number(b.points >= needed) - Number(a.points >= needed) || a.price - b.price)
      .slice(0, 12)
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

export async function getCartView(userId: string) {
  const groups = await resolveCart(userId);
  return { ...buildCartView(groups), points: await pointsView(groups) };
}
