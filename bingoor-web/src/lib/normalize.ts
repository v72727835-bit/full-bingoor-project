/**
 * One place that turns backend documents into the shapes the UI uses.
 *
 * The API returns Mongo documents (`_id`) and names its product artwork by
 * key ("glass-of-milk") rather than by URL, so every list and detail response
 * is funnelled through here. Components then only ever see `id` and a ready
 * `art` path, which keeps React keys and cart lookups from silently breaking.
 */

import { artSrc } from './art';
import {
  Address,
  Banner,
  CartItem,
  CartPoints,
  CartView,
  Category,
  FestivalPage,
  Home,
  HomeSection,
  MediaItem,
  Notice,
  Order,
  OrderItem,
  Product,
  RawBanner,
  RawAddress,
  RawCategory,
  RawProduct,
  RawRef,
  RawReview,
  RawShop,
  Ref,
  Review,
  Shop,
  Ticket,
} from './types';

const idOf = (doc: { _id?: string; id?: string } | null | undefined): string => doc?._id ?? doc?.id ?? '';

/**
 * The catalogue can list the same product twice inside one section, which
 * would hand React two children with the same key. Drop the repeats.
 */
function unique<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return !item.id;
    seen.add(item.id);
    return true;
  });
}

/**
 * A shop's address is a document ({line1, city, state, pincode}), never a
 * string. Flatten it here — handing that object to JSX renders nothing and
 * throws "Objects are not valid as a React child", taking the page with it.
 */
function addressLine(value: string | RawAddress | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  const line = [value.line1, value.line2, value.landmark, value.city, value.state, value.pincode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  return line || undefined;
}

/** Mongo stores points as GeoJSON ([lng, lat]); the UI wants {lat, lng}. */
function point(value: unknown): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as { lat?: number; lng?: number; coordinates?: number[] };
  if (typeof v.lat === 'number' && typeof v.lng === 'number') return { lat: v.lat, lng: v.lng };
  if (Array.isArray(v.coordinates) && v.coordinates.length >= 2) {
    const [lng, lat] = v.coordinates;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  }
  return undefined;
}

function ref(value: RawRef | string | undefined): Ref | undefined {
  if (!value || typeof value === 'string') return undefined;
  const id = idOf(value);
  if (!id) return undefined;
  return { id, name: value.name ?? '', slug: value.slug ?? '', isOpen: value.isOpen };
}

export function product(raw: RawProduct): Product {
  const images = (raw.images ?? []).filter(Boolean);
  const price = raw.price ?? 0;
  const mrp = raw.mrp;
  const discount =
    raw.discountPercent ?? (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);
  const stock = raw.stock ?? 0;
  const foodType = raw.foodType === 'veg' || raw.foodType === 'nonveg' ? raw.foodType : undefined;

  return {
    id: idOf(raw),
    slug: raw.slug,
    name: raw.name,
    nameHi: raw.nameHi || undefined,
    brand: raw.brand || undefined,
    description: raw.description || undefined,
    art: artSrc(raw.icon),
    images,
    video: raw.video || undefined,
    photo: images[0] ?? artSrc(raw.icon),
    unit: raw.unit || undefined,
    price,
    mrp: mrp && mrp > price ? mrp : undefined,
    discountPercent: discount,
    inStock: raw.inStock ?? stock > 0,
    stock,
    // A bare number typed into the admin's card label ("4.5") is a star rating.
    rating: raw.rating || labelStars(raw.ratingLabel),
    ratingCount: raw.ratingCount,
    ratingLabel: labelStars(raw.ratingLabel) ? undefined : raw.ratingLabel || undefined,
    deliveryDays: raw.deliveryDays ?? null,
    codAvailable: raw.codAvailable !== false,
    onlineAvailable: raw.onlineAvailable !== false,
    variants: (raw.variants ?? []).map((v) => ({
      id: idOf(v),
      slug: v.slug,
      label: v.label || v.unit || '',
      price: v.price ?? 0,
      mrp: v.mrp && v.mrp > (v.price ?? 0) ? v.mrp : undefined,
      inStock: v.inStock ?? (v.stock ?? 0) > 0,
      image: v.images?.find(Boolean) || (v.icon ? artSrc(v.icon) : undefined),
    })),
    foodType,
    attributes: raw.attributes ?? [],
    shop: ref(raw.shop),
    category: ref(raw.category),
    reviews: raw.reviews?.map(review),
    related: raw.related?.map(product),
    relatedOther: raw.relatedOther ? { category: raw.relatedOther.category, items: raw.relatedOther.items.map(product) } : null,
    relatedRows: raw.relatedRows?.map((r) => ({ title: r.title, category: r.category, items: r.items.map(product) })),
  };
}

/**
 * Short labels are cut from longer names ("Dairy, Bread & Eggs" -> "Dairy,"),
 * so a dangling comma or ampersand often comes along. Trim it rather than
 * print it in a nav chip.
 */
const tidyShort = (value?: string): string | undefined => {
  const trimmed = value?.trim().replace(/[,&\-–—]+$/, '').trim();
  return trimmed || undefined;
};

export function category(raw: RawCategory): Category {
  return {
    id: idOf(raw),
    slug: raw.slug,
    name: raw.name,
    nameHi: raw.nameHi || undefined,
    short: tidyShort(raw.short),
    art: artSrc(raw.icon),
    image: raw.image || undefined,
    tint: raw.tint || undefined,
    level: raw.level ?? 1,
    parent: raw.parent && typeof raw.parent === 'object' ? idOf(raw.parent) : raw.parent ?? null,
    parentCategory: raw.parent && typeof raw.parent === 'object' ? category(raw.parent) : undefined,
    siblings: raw.siblings?.map(category),
    children: raw.children?.map(category),
  };
}

export function shop(raw: RawShop): Shop {
  return {
    id: idOf(raw),
    slug: raw.slug,
    name: raw.name,
    description: raw.description || undefined,
    address: addressLine(raw.address),
    logo: raw.logo || undefined,
    art: artSrc('department-store'),
    isOpen: raw.isOpen ?? true,
    rating: raw.rating,
    ratingCount: raw.ratingCount,
    minOrderAmount: raw.minOrderAmount,
    deliveryFee: raw.deliveryFee,
    location: point(raw.location),
  };
}

export function review(raw: RawReview): Review {
  const user = typeof raw.user === 'string' ? undefined : raw.user;
  return {
    id: idOf(raw),
    rating: raw.rating,
    comment: raw.comment || undefined,
    userName: user?.name || 'Bingoor customer',
    createdAt: raw.createdAt,
  };
}

export function banner(raw: RawBanner): Banner {
  return {
    id: raw.id,
    title: raw.title || undefined,
    subtitle: raw.subtitle || undefined,
    cta: raw.cta || undefined,
    art: artSrc(raw.icon),
    image: raw.image || undefined,
    from: raw.from || '#0E8A3E',
    to: raw.to || '#0F5C32',
    slug: raw.slug || undefined,
    categoryName: raw.categoryName || undefined,
  };
}

/** "4.5" or "4.5★" in the admin's rating label, read as a star rating; anything else is just a label. */
function labelStars(label?: string): number | undefined {
  const m = /^\s*([0-5](?:\.\d)?)\s*★?\s*$/.exec(label ?? '');
  const n = m ? Number(m[1]) : 0;
  return n > 0 && n <= 5 ? n : undefined;
}

/** Unknown section types are dropped rather than rendered as an empty block. */
function section(raw: Record<string, unknown>): HomeSection | null {
  const type = raw.type as string;
  const id = (raw.id as string) ?? type;
  const items = (raw.items as unknown[]) ?? [];

  switch (type) {
    case 'circleRail':
      return {
        kind: 'circleRail',
        id,
        title: raw.title as string | undefined,
        items: unique(items.map((i) => category(i as RawCategory))),
      };
    case 'bannerCarousel':
      return { kind: 'bannerCarousel', id, items: unique(items.map((i) => banner(i as RawBanner))) };
    case 'categoryGrid':
      return {
        kind: 'categoryGrid',
        id,
        title: (raw.title as string) ?? '',
        titleHi: (raw.titleHi as string) || undefined,
        groupSlug: raw.groupSlug as string | undefined,
        items: unique(items.map((i) => category(i as RawCategory))),
      };
    case 'productRail':
      return {
        kind: 'productRail',
        id,
        title: (raw.title as string) ?? '',
        titleHi: (raw.titleHi as string) || undefined,
        subtitle: raw.subtitle as string | undefined,
        tint: raw.tint as string | undefined,
        style: raw.style as string | undefined,
        seeAllSlug: raw.seeAllSlug as string | undefined,
        items: unique(items.map((i) => product(i as RawProduct))),
      };
    case 'productGrid':
      return {
        kind: 'productGrid',
        id,
        title: (raw.title as string) ?? '',
        titleHi: (raw.titleHi as string) || undefined,
        subtitle: raw.subtitle as string | undefined,
        style: raw.style as string | undefined,
        items: unique(items.map((i) => product(i as RawProduct))),
      };
    case 'storeTiles':
      return {
        kind: 'storeTiles',
        id,
        title: (raw.title as string) ?? '',
        items: unique(items.map((i) => shop(i as RawShop))),
      };
    default:
      return null;
  }
}

export function home(raw: Record<string, unknown>): Home {
  const sections = ((raw.sections as Record<string, unknown>[]) ?? [])
    .map(section)
    .filter((s): s is HomeSection => s !== null)
    // A section with nothing in it would render as a stray heading.
    .filter((s) => s.items.length > 0);

  return {
    deliveryMins: (raw.deliveryMins as number) ?? 0,
    deliveryText: (raw.deliveryText as string) || undefined,
    serviceable: raw.serviceable !== false,
    shopCount: (raw.shopCount as number) ?? 0,
    topTabs: ((raw.topTabs as RawCategory[]) ?? []).map(category),
    sections,
    categories: ((raw.categories as RawCategory[]) ?? []).map(category),
    popularProducts: ((raw.popularProducts as RawProduct[]) ?? []).map(product),
    newArrivals: ((raw.newArrivals as RawProduct[]) ?? []).map(product),
    shops: ((raw.shops as RawShop[]) ?? []).map(shop),
  };
}

/* --------------------------------- account ------------------------------- */

export function address(raw: Record<string, unknown>): Address {
  return {
    id: idOf(raw as { _id?: string; id?: string }),
    label: (raw.label as Address['label']) ?? 'home',
    name: (raw.name as string) ?? '',
    phone: (raw.phone as string) ?? '',
    line1: (raw.line1 as string) ?? '',
    line2: (raw.line2 as string) || undefined,
    landmark: (raw.landmark as string) || undefined,
    city: (raw.city as string) ?? '',
    state: (raw.state as string) ?? '',
    pincode: (raw.pincode as string) ?? '',
    location: point(raw.location),
    isDefault: raw.isDefault as boolean | undefined,
  };
}

function cartItem(raw: Record<string, unknown>): CartItem {
  const images = (raw.images as string[]) ?? [];
  return {
    productId: (raw.productId as string) ?? idOf(raw as { _id?: string; id?: string }),
    name: (raw.name as string) ?? '',
    nameHi: (raw.nameHi as string) || undefined,
    slug: (raw.slug as string) ?? '',
    art: artSrc(raw.icon as string | undefined),
    image: ((raw.image as string) || images[0]) ?? undefined,
    unit: (raw.unit as string) || undefined,
    price: (raw.price as number) ?? 0,
    mrp: raw.mrp as number | undefined,
    quantity: (raw.quantity as number) ?? 0,
    lineTotal: (raw.lineTotal as number) ?? 0,
    stock: (raw.stock as number) ?? 0,
    deliveryDays: (raw.deliveryDays as number | null) ?? null,
    codAvailable: (raw.codAvailable as boolean) ?? true,
    onlineAvailable: (raw.onlineAvailable as boolean) ?? true,
    issue: (raw.issue as string) ?? null,
  };
}

export function cart(raw: Record<string, unknown>): CartView {
  const groups = ((raw.groups as Record<string, unknown>[]) ?? []).map((g) => {
    const s = (g.shop as Record<string, unknown>) ?? {};
    return {
      shop: {
        id: idOf(s as { _id?: string; id?: string }),
        name: (s.name as string) ?? '',
        slug: (s.slug as string) ?? '',
        logo: (s.logo as string) || undefined,
        isOpen: (s.isOpen as boolean) ?? true,
        minOrderAmount: (s.minOrderAmount as number) ?? 0,
      },
      items: ((g.items as Record<string, unknown>[]) ?? []).map(cartItem),
      subtotal: (g.subtotal as number) ?? 0,
      deliveryFee: (g.deliveryFee as number) ?? 0,
      total: (g.total as number) ?? 0,
      meetsMinOrder: (g.meetsMinOrder as boolean) ?? true,
    };
  });

  const pts = (raw.points as Record<string, unknown>) ?? {};
  const points: CartPoints = {
    enabled: (pts.enabled as boolean) ?? false,
    met: (pts.met as boolean) ?? true,
    autoAddId: (pts.autoAddId as string) ?? null,
    suggestions: ((pts.suggestions as Record<string, unknown>[]) ?? []).map((x) => ({
      productId: (x.productId as string) ?? '',
      name: (x.name as string) ?? '',
      slug: (x.slug as string) ?? '',
      art: artSrc(x.icon as string | undefined),
      image: (x.image as string) || undefined,
      unit: (x.unit as string) || undefined,
      price: (x.price as number) ?? 0,
      mrp: x.mrp as number | undefined,
    })),
  };

  return {
    quote: (raw.quote as CartView['quote']) ?? null,
    points,
    groups,
    itemCount: (raw.itemCount as number) ?? 0,
    subtotal: (raw.subtotal as number) ?? 0,
    deliveryFee: (raw.deliveryFee as number) ?? 0,
    total: (raw.total as number) ?? 0,
    hasIssues: (raw.hasIssues as boolean) ?? false,
    freeDeliveryAbove: (raw.freeDeliveryAbove as number) ?? 0,
  };
}

export function order(raw: Record<string, unknown>): Order {
  const items = ((raw.items as Record<string, unknown>[]) ?? []).map(
    (i): OrderItem => ({
      productId: (i.productId as string) ?? idOf(i as { _id?: string; id?: string }),
      name: (i.name as string) ?? '',
      art: artSrc(i.icon as string | undefined),
      image: (i.image as string) || undefined,
      unit: (i.unit as string) || undefined,
      price: (i.price as number) ?? 0,
      quantity: (i.quantity as number) ?? 0,
      lineTotal: (i.lineTotal as number) ?? 0,
    }),
  );

  return {
    id: idOf(raw as { _id?: string; id?: string }),
    orderNumber: (raw.orderNumber as string) ?? '',
    deliveryDays: (raw.deliveryDays as number) ?? null,
    status: (raw.status as Order['status']) ?? 'placed',
    items,
    address: address((raw.address as Record<string, unknown>) ?? {}),
    paymentMethod: (raw.paymentMethod as Order['paymentMethod']) ?? 'cod',
    subtotal: (raw.subtotal as number) ?? 0,
    deliveryFee: (raw.deliveryFee as number) ?? 0,
    total: (raw.total as number) ?? 0,
    deliveryOtp: (raw.deliveryOtp as string) ?? null,
    note: (raw.note as string) || undefined,
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
    shop: ref(raw.shop as RawRef | undefined),
    rider: riderOf(raw.rider),
    riderLocation: point(raw.riderLocation) && { ...point(raw.riderLocation)!, at: (raw.riderLocation as { at?: string }).at },
    shopLocation: point((raw.shop as { location?: unknown } | undefined)?.location),
  };
}

function riderOf(value: unknown): Order['rider'] {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as { name?: string; phone?: string };
  return r.name ? { name: r.name, phone: r.phone || undefined } : undefined;
}

/** A row of the festival tab: the aisle, its name and the products in it. */
export function festival(raw: Record<string, unknown>): FestivalPage {
  const sections = ((raw.sections as Record<string, unknown>[]) ?? []).map((s) => ({
    title: (s.title as string) ?? '',
    category: category(s.category as RawCategory),
    items: unique(((s.items as RawProduct[]) ?? []).map(product)),
  }));
  return {
    enabled: (raw.enabled as boolean) ?? false,
    name: (raw.name as string) || 'Festival',
    banner: (raw.banner as string) || null,
    sections: sections.filter((s) => s.items.length > 0),
  };
}

export function notice(raw: Record<string, unknown>): Notice {
  return {
    id: idOf(raw as { _id?: string; id?: string }),
    message: (raw.message as string) ?? '',
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
  };
}

export function ticket(raw: Record<string, unknown>): Ticket {
  return {
    id: idOf(raw as { _id?: string; id?: string }),
    query: (raw.query as string) ?? '',
    phone: (raw.phone as string) ?? '',
    status: (raw.status as Ticket['status']) ?? 'open',
    messages: ((raw.messages as Record<string, unknown>[]) ?? []).map((m) => ({
      from: (m.from as 'customer' | 'admin') ?? 'customer',
      text: (m.text as string) ?? '',
      at: (m.at as string) ?? new Date().toISOString(),
    })),
    customerUnread: (raw.customerUnread as number) ?? 0,
    lastMessageAt: (raw.lastMessageAt as string) ?? new Date().toISOString(),
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
  };
}


export function media(raw: Record<string, unknown>): MediaItem {
  return {
    id: idOf(raw as { _id?: string; id?: string }),
    kind: raw.kind === 'video' ? 'video' : 'photo',
    title: (raw.title as string) ?? '',
    caption: (raw.caption as string) || undefined,
    url: (raw.url as string) ?? '',
    thumbnail: (raw.thumbnail as string) || undefined,
    videoType: raw.videoType as MediaItem['videoType'],
    embedUrl: (raw.embedUrl as string) || undefined,
  };
}
