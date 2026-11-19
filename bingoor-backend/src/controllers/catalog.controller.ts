import { FilterQuery, SortOrder, Types } from 'mongoose';
import { pointsProductIds } from '../services/cart.service';
import { codTimeBlocked, paymentOptions, quoteDelivery } from '../services/pricing.service';
import { Banner } from '../models/Banner';
import { Category } from '../models/Category';
import { IProduct, Product } from '../models/Product';
import { getIntegrations } from '../services/integrations.service';
import { razorpayEnabled } from '../services/razorpay.service';
import { StandardCategory } from '../models/StandardCategory';
import { Shop } from '../models/Shop';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { escapeRegex, idOrSlugFilter } from '../utils/helpers';
import { ok, pageMeta } from '../utils/response';
import { haversineKm } from '../utils/helpers';
import { cachedSettings, loadSettings, productRules } from '../services/settings.service';
import { mapLimit } from '../utils/mapLimit';

const CARD_FIELDS =
  'name slug brand images icon price mrp unit stock attributes foodType rating ratingCount ratingLabel variantGroup variantLabel nameHi shop category paymentMode';
const SHOP_CARD_FIELDS =
  'name slug logo banner description isOpen rating ratingCount deliveryFee minOrderAmount deliveryRadiusKm address location';
const CAT_FIELDS = 'name nameHi slug icon image tint parent level';

/** Adds the computed bits every product card shows. */
/**
 * A product stocked in several warehouses is one listing per warehouse in the
 * database. Without a delivery location (so no single warehouse to pick) a
 * customer must still see it once: keep one copy per product/size group and aisle.
 */
function oneListingPerItem<T extends { name?: string; unit?: string; variantGroup?: string; category?: unknown }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((p) => {
    const cat = p.category && typeof p.category === 'object' && '_id' in (p.category as object) ? (p.category as { _id: unknown })._id : p.category;
    // Different sizes/prices in one admin size group are one customer-facing
    // product card. The size picker carries the individual options.
    const group = p.variantGroup?.trim().toLowerCase();
    const key = group
      ? `group:${group}|${String(cat ?? '')}`
      : `${(p.name ?? '').trim().toLowerCase()}|${(p.unit ?? '').trim().toLowerCase()}|${String(cat ?? '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A copied warehouse listing can repeat the same size inside one size group. */
function oneVariantPerSize<T extends { variantLabel?: string; unit?: string; stock?: number }>(items: T[]): T[] {
  const bySize = new Map<string, T>();
  for (const item of items) {
    const label = (item.variantLabel || item.unit || '').trim().toLowerCase();
    const current = bySize.get(label);
    if (!current || ((item.stock ?? 0) > 0 && (current.stock ?? 0) <= 0)) bySize.set(label, item);
  }
  return [...bySize.values()];
}

function toCard<T extends { price: number; mrp: number; stock: number; category?: unknown; paymentMode?: 'both' | 'cod' | 'online' }>(p: T) {
  return {
    ...p,
    // 6-day aisles and aisles without cash on delivery, set in the admin panel.
    ...productRules(p.category, p.paymentMode),
    discountPercent: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    inStock: p.stock > 0,
  };
}

/**
 * Point 22: every size of the item behind each card (e.g. 500 g / 1 kg / 2 kg),
 * so the card can offer "ADD - 3 options" and open them in a sheet. Sizes share
 * the admin's "Size group"; only unique sizes from the card's own warehouse are
 * listed, and a card whose item has a single size is left as it was.
 */
async function attachVariants(cards: Record<string, unknown>[]): Promise<void> {
  const groups = [...new Set(cards.map((c) => c.variantGroup).filter((g): g is string => typeof g === 'string' && g.length > 0))];
  if (!groups.length) return;
  const sizes = await Product.find({ variantGroup: { $in: groups }, isActive: true })
    .sort({ price: 1 })
    .select('slug unit price mrp stock images icon variantLabel variantGroup shop')
    .lean();
  const byGroup = new Map<string, typeof sizes>();
  for (const v of sizes) byGroup.set(v.variantGroup!, [...(byGroup.get(v.variantGroup!) ?? []), v]);
  for (const c of cards) {
    const list = typeof c.variantGroup === 'string' ? byGroup.get(c.variantGroup) : undefined;
    if (!list) continue;
    const shop = c.shop && typeof c.shop === 'object' && '_id' in c.shop ? String((c.shop as { _id: unknown })._id) : c.shop ? String(c.shop) : '';
    const same = oneVariantPerSize(list.filter((v) => !shop || String(v.shop) === shop));
    if (same.length < 2) continue;
    c.variants = same.map((v) => ({
      _id: v._id,
      slug: v.slug,
      label: v.variantLabel || v.unit,
      unit: v.unit,
      price: v.price,
      mrp: v.mrp,
      stock: v.stock,
      inStock: v.stock > 0,
      images: (v.images ?? []).slice(0, 1),
      icon: v.icon,
    }));
  }
}

/** Finds up to `limit` shops near a point, closest first. */
async function nearbyShops(
  lat: number,
  lng: number,
  radiusKm: number,
  extra: FilterQuery<unknown> = {},
  skip = 0,
  limit = 10,
) {
  return Shop.find({
    isActive: true,
    ...extra,
    location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusKm * 1000 } },
  })
    .skip(skip)
    .limit(limit)
    .select(SHOP_CARD_FIELDS)
    .lean();
}

/**
 * Every category id at or below `rootId`.
 *
 * Three levels means at most two hops, so two queries beat a recursive
 * $graphLookup both in code and at the database.
 */
async function categoryFamily(rootId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const kids = (await Category.find({ parent: rootId }).select('_id').lean()).map((c) => c._id as Types.ObjectId);
  if (!kids.length) return [rootId];
  const grandKids = (await Category.find({ parent: { $in: kids } }).select('_id').lean()).map(
    (c) => c._id as Types.ObjectId,
  );
  return [rootId, ...kids, ...grandKids];
}

const visible = { isActive: true, stock: { $gt: 0 } };

/** Active shops whose own delivery radius covers a point, nearest first. */
async function shopsServing(lat: number, lng: number) {
  const shops = await Shop.find({ isActive: true }).select('name location deliveryRadiusKm isOpen').lean();
  return shops
    .map((sh) => {
      const c = sh.location?.coordinates;
      const km = c ? haversineKm(lat, lng, c[1], c[0]) : Infinity;
      return { _id: sh._id as Types.ObjectId, name: sh.name, km, radius: sh.deliveryRadiusKm ?? 10, isOpen: sh.isOpen !== false };
    })
    .filter((sh) => sh.km <= sh.radius)
    .sort((a, b) => a.km - b.km);
}

/**
 * The one warehouse that serves a point. A customer is served by their single
 * nearest warehouse (the nearest open one that covers them; if none is open, the
 * nearest that covers them, so they see it is closed). Every product they see,
 * and so every order they place, belongs to that warehouse - which is how the
 * order reaches that warehouse's rider, the nearest to the customer, rather than
 * always landing on one warehouse because two cover the same spot.
 *
 * Returns null when no point was given (show everything), an empty list when a
 * point was given but no warehouse covers it, or the one serving warehouse's id.
 */
async function servingShopIds(lat?: number, lng?: number): Promise<Types.ObjectId[] | null> {
  if (lat === undefined || lng === undefined) return null;
  const serving = await shopsServing(lat, lng); // nearest first
  if (!serving.length) return [];
  const nearest = serving.find((sh) => sh.isOpen) ?? serving[0];
  return [nearest._id];
}

/**
 * Point 37: a customer past the last distance band (e.g. beyond 30 km) sees only
 * what the admin ticked for long distance: categories (with everything under
 * them), standard-category rows and single products (e.g. from the Diwali
 * menu). Returns the product filter plus the category ids whose tiles may still
 * show - the picked ones, everything under them and the groups above them - or
 * null when there is no restriction (nothing ticked, or the customer is near).
 */
async function farRule(lat?: number, lng?: number): Promise<{ match: FilterQuery<IProduct>; categoryIds: Types.ObjectId[] } | null> {
  if (lat === undefined || lng === undefined) return null;
  const settings = cachedSettings() ?? (await loadSettings()).settings;
  const pricing = settings.pricing;
  const picked = (pricing?.beyondCategories ?? []).map(String);
  const rows = (pricing?.beyondStandardCategories ?? []).map(String);
  const products = (pricing?.beyondProducts ?? []).map(String);
  const bands = pricing?.bands ?? [];
  if ((!picked.length && !rows.length && !products.length) || !bands.length) return null;
  const lastKm = Math.max(...bands.map((b) => b.upToKm));
  const nearest = (await shopsServing(lat, lng))[0]?.km;
  if (nearest === undefined || nearest <= lastKm) return null;

  const all = await Category.find({}).select('_id parent').lean();
  const parentOf = new Map(all.map((c) => [String(c._id), c.parent ? String(c.parent) : null]));
  const keep = new Set<string>();
  for (const id of picked) {
    let cur: string | null = id;
    while (cur && !keep.has(cur)) {
      keep.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }
  const below = new Set(picked);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of all) {
      const parent = c.parent ? String(c.parent) : null;
      if (parent && below.has(parent) && !below.has(String(c._id))) {
        below.add(String(c._id));
        grew = true;
      }
    }
  }
  const oid = (id: string) => new Types.ObjectId(id);
  const either: FilterQuery<IProduct>[] = [];
  if (below.size) either.push({ category: { $in: [...below].map(oid) } });
  if (rows.length) either.push({ standardCategories: { $in: rows.map(oid) } });
  if (products.length) either.push({ _id: { $in: products.map(oid) } });
  return { match: { $or: either }, categoryIds: [...new Set([...keep, ...below])].map(oid) };
}

/**
 * Point 37 (simple version): a customer past the last distance band only sees
 * the categories the admin ticked (plus the parents above them so the menu
 * still leads there, and everything below them). Anyone else sees everything.
 */
async function visibleToFarCustomer<T extends { _id: unknown }>(list: T[], lat?: number, lng?: number): Promise<T[]> {
  const far = await farRule(lat, lng);
  if (!far) return list;
  const allowed = new Set(far.categoryIds.map(String));
  return list.filter((c) => allowed.has(String(c._id)));
}

/**
 * Does any warehouse deliver to this point? Used by the website's "where should we deliver?"
 * step, so a customer outside every warehouse's range is told so instead of seeing products.
 */
export const coverage = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat: number; lng: number };
  const serving = await shopsServing(lat, lng);
  ok(res, {
    serviceable: serving.length > 0,
    warehouses: serving.map((sh) => ({ name: sh.name, distanceKm: Math.round(sh.km * 10) / 10, isOpen: sh.isOpen })),
  });
});

function railQuery(categoryIds: Types.ObjectId[], limit: number, scope: Record<string, unknown> = visible) {
  return Product.find({ ...scope, category: { $in: categoryIds } })
    .sort({ soldCount: -1, rating: -1 })
    .limit(limit * 4)
    .select(CARD_FIELDS)
    .populate('shop', 'name slug isOpen')
    .lean()
    .then((items) => oneListingPerItem(items).slice(0, limit));
}

/* ---------------- home ---------------- */

/** Order of the quick-access circles - what people reach for daily, first. */
const QUICK = ['Fresh Vegetables', 'Fresh Fruits', 'Milk', 'Bread & Buns', 'Potato Chips', 'Soft Drinks', 'Noodles', 'Chocolates', 'Tea', 'Shampoo'];

/**
 * Fallback offer banners, shown until the admin uploads their own. Copy is written for the town it serves - "mandi", "chai pe
 * charcha" - because a generic "Big Sale!" is the first thing that makes an
 * app feel like a template.
 */
const BANNERS = [
  { id: 'ration', category: 'Atta, Rice & Dal', title: 'Monthly ration, sorted', subtitle: 'Atta, dal, oil and more. Save up to 22%', cta: 'Stock up', icon: 'cooked-rice', from: '#5B0F7A', to: '#D6006E' },
  { id: 'fresh', category: 'Vegetables & Fruits', title: 'Fresh from the mandi', subtitle: 'Sabzi and fruits, packed this morning', cta: 'Shop fresh', icon: 'carrot', from: '#0A5A41', to: '#18A56C' },
  { id: 'chai', category: 'Tea, Coffee & Health Drinks', title: 'Chai pe charcha?', subtitle: 'Tea, rusk and namkeen from ₹10', cta: 'Grab a cup', icon: 'teacup-without-handle', from: '#6B2A0C', to: '#E0620E' },
  { id: 'glow', category: 'Skin & Face', title: 'Glow up, delivered', subtitle: 'Skincare and makeup in minutes', cta: 'Explore', icon: 'lipstick', from: '#3E1580', to: '#C2188A' },
];

/** "Grocery & Kitchen" is a heading; the tab strip needs one word. */
function shortName(name: string): string {
  const head = name.split(' & ')[0].trim();
  return head.length > 12 ? head.split(' ')[0] : head;
}

/**
 * The home feed is a list of typed sections rather than a fixed shape, so the
 * merchandising can change here without shipping a new app build.
 */
export const home = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat?: number; lng?: number };

  // With a location, only products from shops that deliver there are shown.
  const serving = await servingShopIds(lat, lng);
  const far = await farRule(lat, lng);
  const scope: FilterQuery<IProduct> = {
    ...(serving ? { ...visible, shop: { $in: serving } } : visible),
    // $and, so a rail's own category filter cannot replace this one.
    ...(far ? { $and: [far.match] } : {}),
  };
  const allowedCat = far ? new Set(far.categoryIds.map(String)) : null;
  const allowCat = <T extends { _id: unknown }>(list: T[]) => (allowedCat ? list.filter((c) => allowedCat.has(String(c._id))) : list);

  const [allGroups, allLevel2, allLevel3, shops, uploadedBanners] = await Promise.all([
    Category.find({ isActive: true, level: 1, parent: null }).sort({ sortOrder: 1 }).select(CAT_FIELDS).lean(),
    Category.find({ isActive: true, level: 2 }).sort({ sortOrder: 1 }).select(CAT_FIELDS).lean(),
    Category.find({ isActive: true, level: 3 }).sort({ sortOrder: 1 }).select(CAT_FIELDS).lean(),
    lat !== undefined && lng !== undefined
      ? nearbyShops(lat, lng, 15, {}, 0, 10)
      : Shop.find({ isActive: true }).sort({ rating: -1 }).limit(10).select(SHOP_CARD_FIELDS).lean(),
    Banner.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(10)
      .populate<{ category: { name: string; slug: string; isActive: boolean } | null }>('category', 'name slug isActive')
      .lean(),
  ]);

  const groups = allowCat(allGroups);
  const level2 = allowCat(allLevel2);
  const level3 = allowCat(allLevel3);

  const l2ByName = new Map(level2.map((c) => [c.name, c]));
  const groupByName = new Map(groups.map((g) => [g.name, g]));

  /* Deals come from the everyday aisles and are ranked by the actual saving,
     so the first thing on the strip is a real bargain on something people buy
     weekly - not a scented candle that happens to sell well. */
  const dealRoots = ['Grocery & Kitchen', 'Snacks & Drinks'].map((n) => groupByName.get(n)).filter(Boolean) as typeof groups;
  const dealIds = (await Promise.all(dealRoots.map((g) => categoryFamily(g._id as Types.ObjectId)))).flat();

  const headliners = ['Vegetables & Fruits', 'Dairy, Bread & Eggs', 'Chips & Namkeen', 'Skin & Face']
    .map((n) => l2ByName.get(n))
    .filter(Boolean) as typeof level2;

  const [trending, dealPool, ...railProducts] = await Promise.all([
    Product.find(scope).sort({ soldCount: -1, rating: -1 }).limit(48).select(CARD_FIELDS).populate('shop', 'name slug isOpen').lean()
      .then((items) => oneListingPerItem(items).slice(0, 12)),
    Product.find({ ...scope, category: { $in: dealIds }, $expr: { $gt: ['$mrp', '$price'] } })
      .sort({ soldCount: -1 })
      .limit(320)
      .select(CARD_FIELDS)
      .populate('shop', 'name slug isOpen')
      .lean()
      .then((items) => oneListingPerItem(items).slice(0, 80)),
    ...headliners.map(async (c) => railQuery(await categoryFamily(c._id as Types.ObjectId), 10, scope)),
  ]);

  // Point 27: when the admin has hand-picked products for Deals of the Day,
  // show all of them (unlimited). Otherwise fall back to the automatic strip of
  // the biggest everyday savings.
  const pickedDeals = oneListingPerItem(await Product.find({ ...scope, dealOfDay: true, $expr: { $gt: ['$mrp', '$price'] } })
    .sort({ soldCount: -1, updatedAt: -1 })
    .select(CARD_FIELDS)
    .populate('shop', 'name slug isOpen')
    .lean());
  const deals = pickedDeals.length
    ? pickedDeals.map(toCard).sort((a, b) => b.discountPercent - a.discountPercent)
    : dealPool
        .map(toCard)
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 12);

  type Section = Record<string, unknown> & { type: string };
  const sections: Section[] = [];

  /* The admin's "Standard categories": named rows pinned above or below everything else. */
  const standardRows = await StandardCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const standard = (
    await mapLimit(standardRows, 4, async (row) => {
        const items = oneListingPerItem(await Product.find({ ...scope, standardCategories: row._id })
          .sort({ sortCode: 1, name: 1 })
          .limit(96)
          .select(CARD_FIELDS)
          .populate('shop', 'name slug isOpen')
          .lean()).slice(0, 24);
        return items.length
          ? ({ type: 'productRail', id: `std-${row._id}`, style: 'standard', title: row.name, titleHi: row.nameHi, position: row.position, items: items.map(toCard) } as Section & { position: string })
          : null;
      })
  ).filter(Boolean) as (Section & { position: string })[];
  sections.push(...standard.filter((r) => r.position === 'top'));

  const circles = QUICK.map((n) => level3.find((c) => c.name === n)).filter(Boolean);
  if (circles.length) sections.push({ type: 'circleRail', id: 'quick', items: circles });

  /* Banners uploaded from the admin panel win; the built-in set only fills
     the slot on a fresh install. */
  const banners = uploadedBanners.length
    ? uploadedBanners.map((b) => {
        const cat = b.category?.isActive ? b.category : null;
        return {
          id: String(b._id),
          title: b.title,
          subtitle: b.subtitle,
          cta: b.cta,
          image: b.image,
          slug: cat?.slug,
          categoryName: cat?.name,
        };
      })
    : BANNERS.map((b) => {
        const cat = l2ByName.get(b.category);
        return cat ? { ...b, slug: cat.slug, categoryName: cat.name } : null;
      }).filter(Boolean);
  if (banners.length) sections.push({ type: 'bannerCarousel', id: 'banners', items: banners });

  if (deals.length) {
    sections.push({
      type: 'productRail',
      id: 'deals',
      style: 'deals',
      title: 'Deals of the day',
      subtitle: 'Prices drop at midnight',
      items: deals,
    });
  }

  for (const g of groups) {
    const tiles = level2.filter((c) => String(c.parent) === String(g._id));
    if (!tiles.length) continue;
    sections.push({ type: 'categoryGrid', id: `grid-${g.slug}`, groupSlug: g.slug, title: g.name, titleHi: g.nameHi, items: tiles });
  }

  const railTitles: Record<string, [string, string]> = {
    'Vegetables & Fruits': ['Fresh picks for today', 'Straight from the mandi'],
    'Dairy, Bread & Eggs': ['Your morning basket', 'Milk, bread and eggs before chai'],
    'Chips & Namkeen': ['Stock up on crunchy snacks', 'For the match, the guests, the 4 pm hunger'],
    'Skin & Face': ['Skincare that works', 'Serums, sunscreen and face wash'],
  };

  headliners.forEach((c, i) => {
    const items = railProducts[i] ?? [];
    if (!items.length) return;
    const [title, subtitle] = railTitles[c.name] ?? [c.name, undefined];
    const group = groups.find((g) => String(g._id) === String(c.parent));
    sections.push({
      type: 'productRail',
      id: `rail-${c.slug}`,
      groupSlug: group?.slug,
      title,
      // The Hindi aisle name only fits when the title is the aisle's own name.
      titleHi: title === c.name ? c.nameHi : undefined,
      subtitle,
      tint: c.tint,
      seeAllSlug: c.slug,
      items: items.map(toCard),
    });
  });

  if (trending.length) {
    sections.push({
      type: 'productGrid',
      id: 'trending',
      style: 'trending',
      title: 'Trending near you',
      subtitle: shops[0]?.address?.city
        ? `What ${shops[0].address.city} is ordering right now`
        : 'What your neighbours are ordering right now',
      items: trending.map(toCard),
    });
  }

  sections.push(...standard.filter((r) => r.position === 'bottom'));

  if (shops.length) sections.push({ type: 'storeTiles', id: 'stores', title: 'Warehouses near you', items: shops });

  const homeSettings = (await loadSettings()).settings;
  const instant = homeSettings.deliverySlots?.find((x) => x.key === 'instant');
  // The admin's default promise (shown when no address/location is set).
  const defaultText = instant?.label || '19 minutes';
  // Point 1/2/6: with a location, show the real promise for that distance;
  // without one, keep the admin's default. The nearest serving shop's distance
  // drives the delivery days through the same pricing bands checkout uses.
  // The near-band promise is always in minutes (19 min within 15 km), not a vague
  // "Fast delivery" label, so the header shows a real time when the customer is close.
  const deliveryMins = Number(/(\d+)\s*min/i.exec(defaultText)?.[1]) || 19;
  let deliveryText = defaultText;
  let deliveryDays = 0;
  if (lat !== undefined && lng !== undefined) {
    const nearestKm = (await shopsServing(lat, lng))[0]?.km ?? null;
    if (nearestKm !== null) {
      const q = quoteDelivery(homeSettings, { subtotal: 0, distanceKm: nearestKm, slot: 'instant' });
      deliveryDays = q.days;
      // Near band: exactly what the admin set for the fast slot ("19 minutes", or
      // "2 hours" when they change it), so every customer sees the admin's promise.
      deliveryText = q.days >= 2 ? `${q.days} days delivery` : q.days === 1 ? 'Next day delivery' : defaultText;
    }
  }

  // One tab per group, never two with the same label, even if the data drifts.
  const seen = new Set<string>();
  const topTabs = groups
    .map((g) => ({ ...g, _id: String(g._id), short: shortName(g.name) }))
    .filter((t) => (seen.has(t.short) ? false : (seen.add(t.short), true)));

  // Point 22: product rows carry each item's other sizes.
  await attachVariants(
    sections.flatMap((x) => (x.type === 'productRail' || x.type === 'productGrid') && Array.isArray(x.items) ? (x.items as Record<string, unknown>[]) : []),
  );
  ok(res, {
    deliveryMins,
    /** Delivery days for the customer's distance band: 0 = same day / minutes, 1 = next day, 3 = long distance. */
    deliveryDays,
    /** The home-page delivery promise as the admin wrote it ("19 minutes", "2 hours", "Next day delivery"). */
    deliveryText,
    /** False when a location was sent and no shop delivers there yet. */
    serviceable: serving === null || serving.length > 0,
    shopCount: shops.length,
    /* Legacy keys kept so an older build of the app keeps working */
    categories: level2.slice(0, 12),
    popularProducts: trending.map(toCard),
    newArrivals: deals,
    shops,
    topTabs,
    sections,
  });
});

/* ---------------- categories ---------------- */
/** Whole three-level tree in one request; the Categories tab renders it directly. */
export const categoryTree = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat?: number; lng?: number };
  const all = await visibleToFarCustomer(
    await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select(CAT_FIELDS).lean(),
    lat,
    lng,
  );
  const kidsOf = (id: unknown) => all.filter((c) => String(c.parent) === String(id));
  ok(
    res,
    all
      .filter((c) => c.level === 1)
      .map((g) => ({
        ...g,
        children: kidsOf(g._id).map((c) => ({ ...c, children: kidsOf(c._id) })),
      })),
  );
});

export const listCategories = asyncHandler(async (req, res) => {
  const { parent, level, all, lat, lng } = req.query as unknown as { parent?: string; level?: number; all?: boolean; lat?: number; lng?: number };

  if (all) return ok(res, await visibleToFarCustomer(await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select(CAT_FIELDS).lean(), lat, lng));

  const filter: FilterQuery<unknown> = { isActive: true };
  if (parent) filter.parent = parent;
  else if (level) filter.level = level;
  else filter.parent = null;

  const categories = await visibleToFarCustomer(await Category.find(filter).sort({ sortOrder: 1, name: 1 }).select(CAT_FIELDS).lean(), lat, lng);

  // Top-level request gets its children inlined so the menu needs one call.
  if (!parent) {
    const subs = await visibleToFarCustomer(
      await Category.find({ isActive: true, parent: { $in: categories.map((c) => c._id) } })
        .sort({ sortOrder: 1, name: 1 })
        .select(CAT_FIELDS)
        .lean(),
      lat,
      lng,
    );
    return ok(res, categories.map((c) => ({ ...c, children: subs.filter((s) => String(s.parent) === String(c._id)) })));
  }
  ok(res, categories);
});

/** One tile's page: the category, its child rail, and which child is first. */
export const getCategory = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat?: number; lng?: number };
  const category = await Category.findOne({ ...idOrSlugFilter(req.params.idOrSlug), isActive: true }).select(CAT_FIELDS).lean();
  if (!category) throw new ApiError(404, 'Category not found');

  const children = await visibleToFarCustomer(
    await Category.find({ isActive: true, parent: category._id }).sort({ sortOrder: 1, name: 1 }).select(CAT_FIELDS).lean(),
    lat,
    lng,
  );
  const parent = category.parent
    ? await Category.findById(category.parent).select(CAT_FIELDS).lean()
    : null;
  const siblings = parent
    ? await visibleToFarCustomer(
        await Category.find({ isActive: true, parent: parent._id }).sort({ sortOrder: 1, name: 1 }).select(CAT_FIELDS).lean(),
        lat,
        lng,
      )
    : [];

  ok(res, { ...category, parent, children, siblings });
});

/* ---------------- shops ---------------- */
export const listShops = asyncHandler(async (req, res) => {
  const { lat, lng, radiusKm, q, isOpen, page, limit } = req.query as unknown as {
    lat?: number;
    lng?: number;
    radiusKm: number;
    q?: string;
    isOpen?: boolean;
    page: number;
    limit: number;
  };
  const skip = (page - 1) * limit;

  const extra: FilterQuery<unknown> = {};
  if (q) extra.name = { $regex: escapeRegex(q), $options: 'i' };
  if (isOpen !== undefined) extra.isOpen = isOpen;

  if (lat !== undefined && lng !== undefined) {
    const [shops, total] = await Promise.all([
      nearbyShops(lat, lng, radiusKm, extra, skip, limit),
      Shop.countDocuments({
        isActive: true,
        ...extra,
        location: { $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6378.1] } },
      }),
    ]);
    return ok(res, shops, pageMeta(page, limit, total));
  }

  const filter = { isActive: true, ...extra };
  const [shops, total] = await Promise.all([
    Shop.find(filter).sort({ rating: -1, name: 1 }).skip(skip).limit(limit).select(SHOP_CARD_FIELDS).lean(),
    Shop.countDocuments(filter),
  ]);
  ok(res, shops, pageMeta(page, limit, total));
});

export const getShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ ...idOrSlugFilter(req.params.idOrSlug), isActive: true })
    .select(`${SHOP_CARD_FIELDS} phone`)
    .lean();
  if (!shop) throw new ApiError(404, 'Shop not found');

  // Roll the shop's level-3 categories up to their level-2 tiles for the tabs.
  const leafIds = await Product.find({ shop: shop._id, isActive: true }).distinct('category');
  const leaves = await Category.find({ _id: { $in: leafIds }, isActive: true }).select(CAT_FIELDS).lean();
  const parentIds = [...new Set(leaves.map((c) => String(c.parent)).filter((p) => p !== 'null'))];
  const categories = await Category.find({ _id: { $in: parentIds }, isActive: true }).sort({ sortOrder: 1 }).select(CAT_FIELDS).lean();

  ok(res, { ...shop, categories: categories.length ? categories : leaves });
});

/* ---------------- products ---------------- */
async function resolveIdOrSlug(model: typeof Category | typeof Shop, value: string): Promise<Types.ObjectId | null> {
  const found = await (model as typeof Category).findOne(idOrSlugFilter(value)).select('_id').lean();
  return found ? (found._id as Types.ObjectId) : null;
}

export const listProducts = asyncHandler(async (req, res) => {
  const { q, category, shop, brand, minPrice, maxPrice, inStock, minRating, minDiscount, foodType, sort, page, limit, lat, lng } = req.query as unknown as {
    minRating?: number;
    minDiscount?: number;
    foodType?: 'veg' | 'nonveg';
    lat?: number;
    lng?: number;
    q?: string;
    category?: string;
    shop?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort: string;
    page: number;
    limit: number;
  };

  const filter: FilterQuery<IProduct> = { isActive: true };

  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { brand: rx }, { tags: rx }];
  }

  if (category) {
    const catId = await resolveIdOrSlug(Category, category);
    if (!catId) return ok(res, [], pageMeta(page, limit, 0));
    filter.category = { $in: await categoryFamily(catId) };
  }

  if (shop) {
    const shopId = await resolveIdOrSlug(Shop, shop);
    if (!shopId) return ok(res, [], pageMeta(page, limit, 0));
    filter.shop = shopId;
  }

  if (brand) filter.brand = brand;

  if (!shop) {
    const serving = await servingShopIds(lat, lng);
    if (serving) filter.shop = { $in: serving };
    const far = await farRule(lat, lng);
    if (far) filter.$and = [...((filter.$and as FilterQuery<IProduct>[] | undefined) ?? []), far.match];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    };
  }
  if (inStock) filter.stock = { $gt: 0 };
  if (minRating) filter.rating = { $gte: minRating };
  if (foodType) filter.foodType = foodType;
  if (minDiscount) {
    // price <= mrp * (1 - d/100): at least that much off the MRP.
    filter.$expr = { $lte: ['$price', { $multiply: ['$mrp', 1 - minDiscount / 100] }] };
  }

  const sortMap: Record<string, Record<string, SortOrder>> = {
    relevance: { sortCode: 1, name: 1, _id: 1 },
    name: { name: 1, _id: 1 },
    popular: { soldCount: -1, _id: -1 },
    newest: { createdAt: -1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: 1 },
    rating: { rating: -1, ratingCount: -1, _id: 1 },
  };

  const matchingProducts = oneListingPerItem(
    await Product.find(filter)
      .sort(sortMap[sort])
      .select(CARD_FIELDS)
      .populate('shop', 'name slug isOpen')
      .lean(),
  );
  const products = matchingProducts.slice((page - 1) * limit, page * limit);

  // The representative card's warehouse is used to load the available sizes.
  const cards = products.map(toCard);
  await attachVariants(cards as unknown as Record<string, unknown>[]);
  ok(res, cards, pageMeta(page, limit, matchingProducts.length));
});

/** Brands in an aisle, for the Brand filter. */
export const listBrands = asyncHandler(async (req, res) => {
  const { category } = req.query as { category?: string };
  const filter: FilterQuery<IProduct> = { isActive: true, brand: { $nin: [null, ''] } };
  if (category) {
    const catId = await resolveIdOrSlug(Category, category);
    if (!catId) return ok(res, []);
    filter.category = { $in: await categoryFamily(catId) };
  }
  const brands = (await Product.distinct('brand', filter)) as string[];
  ok(res, brands.sort((a, b) => a.localeCompare(b)).slice(0, 60));
});

/** Type-ahead search box: a handful of matching product names. */
export const suggestProducts = asyncHandler(async (req, res) => {
  const { q, lat, lng } = req.query as unknown as { q: string; lat?: number; lng?: number };
  const rx = { $regex: `^${escapeRegex(q)}|\\b${escapeRegex(q)}`, $options: 'i' };
  const serving = await servingShopIds(lat, lng);
  const far = await farRule(lat, lng);
  const products = await Product.find({
    isActive: true,
    ...(serving ? { shop: { $in: serving } } : {}),
    ...(far ? { $and: [far.match] } : {}),
    $or: [{ name: rx }, { brand: rx }],
  })
    .sort({ soldCount: -1 })
    .limit(8)
    .select('name slug images icon price brand')
    .lean();
  ok(res, products);
});

export const getProduct = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat?: number; lng?: number };
  const product = await Product.findOne({ ...idOrSlugFilter(req.params.idOrSlug), isActive: true })
    .populate('shop', 'name slug logo isOpen deliveryFee minOrderAmount deliveryRadiusKm rating')
    .populate('category', 'name slug icon tint parent level')
    .lean();
  if (!product) throw new ApiError(404, 'Product not found');

  // Point: 6 rows under the product - 2 rows from its own child aisle and 4 rows
  // from 4 other child aisles of the same parent aisle. With a delivery location,
  // only the warehouse that serves it; either way each item shows once.
  const serving = await servingShopIds(lat, lng);
  const shopFilter = serving ? { shop: { $in: serving } } : {};
  const ROW = 10;
  const itemKey = (x: { name?: string; unit?: string; variantGroup?: string }) =>
    x.variantGroup?.trim()
      ? `group:${x.variantGroup.trim().toLowerCase()}`
      : `${(x.name ?? '').trim().toLowerCase()}|${(x.unit ?? '').trim().toLowerCase()}`;
  const sameItem = itemKey(product);
  const rowItems = async (categoryId: Types.ObjectId, max: number) =>
    oneListingPerItem(
      await Product.find({ category: categoryId, isActive: true, stock: { $gt: 0 }, _id: { $ne: product._id }, ...shopFilter })
        .sort({ soldCount: -1 })
        .limit(max * 4)
        .select(CARD_FIELDS)
        .populate('shop', 'name slug isOpen')
        .lean(),
    )
      .filter((x) => itemKey(x) !== sameItem)
      .slice(0, max);

  const cat = product.category as unknown as { _id: Types.ObjectId; name?: string; slug?: string; parent?: Types.ObjectId };
  const own = await rowItems(cat._id, ROW * 2);
  const related = own.slice(0, ROW);
  const rows: { title: string; category: { name: string; slug: string }; items: ReturnType<typeof toCard>[] }[] = [];
  if (related.length) rows.push({ title: 'Similar products', category: { name: cat.name ?? '', slug: cat.slug ?? '' }, items: related.map(toCard) });
  if (own.length > ROW) rows.push({ title: `More in ${cat.name ?? 'this aisle'}`, category: { name: cat.name ?? '', slug: cat.slug ?? '' }, items: own.slice(ROW).map(toCard) });

  let relatedOther: { category: { name: string; slug: string }; items: ReturnType<typeof toCard>[] } | null = null;
  if (cat?.parent) {
    const siblings = await Category.find({ parent: cat.parent, _id: { $ne: cat._id }, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug')
      .lean();
    for (const sib of siblings) {
      if (rows.length >= 6) break;
      const items = await rowItems(sib._id as Types.ObjectId, ROW);
      if (!items.length) continue;
      const row = { title: `More from ${sib.name}`, category: { name: sib.name, slug: sib.slug }, items: items.map(toCard) };
      relatedOther ??= { category: row.category, items: row.items };
      rows.push(row);
    }
  }

  // Other sizes of the same item (e.g. 100 g / 200 g / 500 g), cheapest first.
  const productShopId = String(
    product.shop && typeof product.shop === 'object' && '_id' in product.shop
      ? (product.shop as { _id: unknown })._id
      : product.shop,
  );
  const variants = product.variantGroup
    ? oneVariantPerSize(await Product.find({ variantGroup: product.variantGroup, isActive: true, shop: productShopId })
        .sort({ price: 1 })
        .select('name nameHi slug unit price mrp stock images icon variantLabel')
        .lean())
    : [];

  const card = toCard(product);
  // Point 6: with a delivery location, show the real promise for this distance
  // (the longer of the 6-day aisle rule and the distance-based days). Without a
  // location, the card keeps the aisle rule only (the admin default applies).
  if (lat !== undefined && lng !== undefined) {
    const nearestKm = (await shopsServing(lat, lng))[0]?.km ?? null;
    if (nearestKm !== null) {
      const dq = quoteDelivery((await loadSettings()).settings, { subtotal: 0, distanceKm: nearestKm, slot: 'instant' });
      const eff = Math.max(card.deliveryDays ?? 0, dq.days);
      card.deliveryDays = eff > 0 ? eff : null;
    }
  }
  ok(res, {
    ...card,
    related: related.map(toCard),
    relatedOther,
    /** Up to 6 rows: this aisle (2) and other child aisles of the same parent (4). */
    relatedRows: rows,
    variants: variants.map((v) => ({ ...v, label: v.variantLabel || v.unit, inStock: v.stock > 0 })),
  });
});

/* ---------------- festival tab ---------------- */

/**
 * The festival tab (Rakhi, Diwali, ...). Name, banner and rows are set in the
 * admin panel; each row shows products from one aisle with a "See all" link.
 */
export const festival = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query as unknown as { lat?: number; lng?: number };
  const settings = cachedSettings() ?? (await loadSettings()).settings;
  const fest = settings.festival;
  const serving = await servingShopIds(lat, lng);
  const far = await farRule(lat, lng);
  const scope: FilterQuery<IProduct> = {
    ...(serving ? { ...visible, shop: { $in: serving } } : visible),
    ...(far ? { $and: [far.match] } : {}),
  };

  const categories = await Category.find({ _id: { $in: (fest?.sections ?? []).map((s) => s.category) }, isActive: true })
    .select('name slug level icon image tint')
    .lean();
  const byId = new Map(categories.map((c) => [String(c._id), c]));

  const sections = await Promise.all(
    (fest?.sections ?? []).map(async (s) => {
      const cat = byId.get(String(s.category));
      if (!cat) return null;
      // 21 to a row: the festival page slides sideways, so a short row looks bare.
      const items = await railQuery(await categoryFamily(cat._id as Types.ObjectId), 21, scope);
      return { title: s.title || cat.name, category: cat, items: items.map(toCard) };
    }),
  );

  await attachVariants(sections.flatMap((x) => (x ? (x.items as unknown as Record<string, unknown>[]) : [])));
  ok(res, {
    enabled: fest?.enabled ?? false,
    name: fest?.name || 'Festival',
    banner: fest?.banner || null,
    sections: sections.filter((s) => s && s.items.length),
  });
});

/** Settings every client needs at start-up: festival tab name, app links, delivery promise. */
export const publicSettings = asyncHandler(async (_req, res) => {
  const settings = cachedSettings() ?? (await loadSettings()).settings;
  const live = await getIntegrations();
  ok(res, {
    festival: { enabled: settings.festival?.enabled ?? false, name: settings.festival?.name || 'Festival', banner: settings.festival?.banner || null },
    popup: {
      enabled: settings.popup?.enabled ?? false,
      intervalSeconds: settings.popup?.intervalSeconds ?? 210,
      pages: (settings.popup?.pages ?? []).filter((p) => p.image).map((p) => ({ image: p.image, link: p.link || null })),
    },
    appLinks: settings.appLinks ?? {},
    // Only the pages the admin filled in, so an empty one never shows an icon.
    socialLinks: Object.fromEntries(Object.entries(settings.socialLinks ?? {}).filter(([, v]) => typeof v === 'string' && /^https?:\/\//i.test(v))),
    socialOther: (settings.socialOther ?? []).filter((s) => s.label && /^https?:\/\//i.test(s.url)).map((s) => ({ label: s.label, url: s.url })),
    company: { name: settings.company?.name ?? '', logo: settings.company?.logo ?? '', tagline: settings.company?.tagline ?? '' },
    sixDayDays: settings.sixDay?.days ?? 6,
    codMessage: settings.cod?.message,
    codCutoff: codTimeBlocked(settings),
    supportPhone: settings.supportPhone ?? '',
    // Only the slots the admin left on, so a hidden slot disappears from every client.
    deliverySlots: (settings.deliverySlots ?? []).filter((s) => s.enabled).map((s) => ({ key: s.key, label: s.label })),
    twoHourCharge: settings.twoHourCharge ?? { enabled: false, amount: 0 },
    pricing: {
      handlingFee: settings.pricing?.handlingFee ?? 2,
      bands: settings.pricing?.bands ?? [],
    },
    filters: (settings.filters ?? []).filter((f) => f.enabled).map((f) => ({ key: f.key, label: f.label, kind: f.kind })),
    priceSortEnabled: settings.priceSortEnabled ?? true,
    googleReviewUrl: settings.googleReviewUrl ?? '',
    // Maps: clients use Google Maps when a key is set in the admin panel, else
    // they show a Google Maps configuration error. The key is a client-side (referrer-restricted) key.
    maps: { provider: 'google', googleMapsApiKey: live.googleMapsApiKey ?? null },
    cartPointsOn: !!settings.cartPoints?.enabled,
    // #36: the ways to pay at checkout, with the admin's charges (percent of the bill).
    paymentOptions: paymentOptions(settings).filter((o) => o.enabled),
    onlinePaymentOn: await razorpayEnabled(),
    // Public client ids only; the secrets never leave the server.
    social: {
      googleClientId: live.googleClientId ?? null,
      facebookAppId: live.facebookAppId ?? null,
      // Only when the secret is saved too, so the button never leads to a login that cannot finish.
      instagramAppId: live.instagramAppId && live.instagramAppSecret ? live.instagramAppId : null,
    },
  });
});

/** #35: the full page behind "See all" under the cart - the admin's cart-row products, by sort code. */
export const pointsProducts = asyncHandler(async (_req, res) => {
  const ids = await pointsProductIds();
  const rows = await Product.find({ _id: { $in: ids } }).select(CARD_FIELDS).populate('shop', 'name slug isOpen').lean();
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  ok(res, ids.map((id) => byId.get(String(id))).filter(Boolean).map((p) => toCard(p!)));
});
