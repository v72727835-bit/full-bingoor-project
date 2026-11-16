/**
 * The shapes the Bingoor backend actually sends (Mongo documents, so `_id`)
 * and the shapes this app works with (`id`). Everything crossing the API
 * boundary goes through `normalize.ts` so no component ever sees `_id`.
 */

/* ---------------------------------- raw --------------------------------- */

export interface RawRef {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  isOpen?: boolean;
}

export interface RawProduct {
  _id?: string;
  id?: string;
  shop?: RawRef | string;
  category?: RawRef | string;
  name: string;
  nameHi?: string;
  brand?: string;
  description?: string;
  images?: string[];
  video?: string;
  icon?: string;
  price: number;
  mrp?: number;
  unit?: string;
  stock?: number;
  attributes?: string[];
  foodType?: string;
  rating?: number;
  ratingCount?: number;
  ratingLabel?: string;
  deliveryDays?: number | null;
  codAvailable?: boolean;
  /** False when the product can only be paid for in cash. */
  onlineAvailable?: boolean;
  variants?: RawVariant[];
  slug: string;
  discountPercent?: number;
  inStock?: boolean;
  reviews?: RawReview[];
  related?: RawProduct[];
  relatedOther?: { category: { name: string; slug: string }; items: RawProduct[] } | null;
  relatedRows?: { title: string; category: { name: string; slug: string }; items: RawProduct[] }[];
}

export interface RawVariant {
  _id?: string;
  id?: string;
  slug: string;
  label?: string;
  unit?: string;
  price?: number;
  mrp?: number;
  stock?: number;
  inStock?: boolean;
  images?: string[];
  icon?: string;
}

export interface RawCategory {
  _id?: string;
  id?: string;
  name: string;
  nameHi?: string;
  icon?: string;
  image?: string;
  tint?: string;
  parent?: string | RawCategory | null;
  level?: number;
  slug: string;
  short?: string;
  children?: RawCategory[];
  siblings?: RawCategory[];
}

/** The shop's address arrives as a structured document, not a line of text. */
export interface RawAddress {
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface RawShop {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  address?: string | RawAddress;
  logo?: string;
  location?: { lat: number; lng: number };
  isOpen?: boolean;
  rating?: number;
  ratingCount?: number;
  deliveryRadiusKm?: number;
  minOrderAmount?: number;
  deliveryFee?: number;
  slug: string;
}

export interface RawReview {
  _id?: string;
  id?: string;
  rating: number;
  comment?: string;
  user?: { name?: string } | string;
  createdAt: string;
}

export interface RawBanner {
  id: string;
  category?: string;
  title?: string;
  image?: string;
  subtitle?: string;
  cta?: string;
  icon?: string;
  from?: string;
  to?: string;
  slug?: string;
  categoryName?: string;
}

/* ------------------------------- normalized ------------------------------ */

export interface Ref {
  id: string;
  name: string;
  slug: string;
  isOpen?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  nameHi?: string;
  brand?: string;
  description?: string;
  /** Flat artwork path, always resolvable. */
  art: string;
  /** Real photographs, when the catalogue has any. */
  images: string[];
  /** Optional product video (an uploaded file or a YouTube / Vimeo link). */
  video?: string;
  /** First photograph, else the artwork - what a card shows. */
  photo: string;
  unit?: string;
  price: number;
  mrp?: number;
  discountPercent: number;
  inStock: boolean;
  stock: number;
  rating?: number;
  ratingCount?: number;
  /** What the card prints beside the stars, e.g. "5L+" - set by the admin. */
  ratingLabel?: string;
  /** Delivery promise in days for slow aisles; absent = same-day. */
  deliveryDays?: number | null;
  /** False in aisles where cash on delivery is switched off. */
  codAvailable?: boolean;
  /** False when the product can only be paid for in cash. */
  onlineAvailable?: boolean;
  /** Other sizes of the same item. */
  variants?: ProductVariant[];
  foodType?: 'veg' | 'nonveg';
  attributes: string[];
  shop?: Ref;
  category?: Ref;
  reviews?: Review[];
  related?: Product[];
  relatedOther?: { category: { name: string; slug: string }; items: Product[] } | null;
  /** Up to 6 rows: 2 from this aisle, 4 from other child aisles of the same parent. */
  relatedRows?: { title: string; category: { name: string; slug: string }; items: Product[] }[];
}

export interface ProductVariant {
  id: string;
  slug: string;
  label: string;
  price: number;
  mrp?: number;
  inStock: boolean;
  /** The size's own photo, for the options sheet. */
  image?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameHi?: string;
  short?: string;
  art: string;
  image?: string;
  tint?: string;
  level: number;
  parent?: string | null;
  /** The aisle above, and the aisles beside this one (a category page only). */
  parentCategory?: Category | null;
  siblings?: Category[];
  children?: Category[];
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  description?: string;
  address?: string;
  logo?: string;
  art: string;
  isOpen: boolean;
  rating?: number;
  ratingCount?: number;
  minOrderAmount?: number;
  deliveryFee?: number;
  location?: { lat: number; lng: number };
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  userName: string;
  createdAt: string;
}

export interface Banner {
  id: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  art: string;
  /** Uploaded from the admin panel; fills the whole slide when set. */
  image?: string;
  from: string;
  to: string;
  slug?: string;
  categoryName?: string;
}

export type HomeSection =
  | { kind: 'circleRail'; id: string; title?: string; items: Category[] }
  | { kind: 'bannerCarousel'; id: string; items: Banner[] }
  | { kind: 'categoryGrid'; id: string; title: string; titleHi?: string; groupSlug?: string; items: Category[] }
  | {
      kind: 'productRail';
      id: string;
      title: string;
      /** The admin's Hindi name, shown when the customer picks Hindi. */
      titleHi?: string;
      subtitle?: string;
      tint?: string;
      style?: string;
      seeAllSlug?: string;
      items: Product[];
    }
  | { kind: 'productGrid'; id: string; title: string; titleHi?: string; subtitle?: string; style?: string; items: Product[] }
  | { kind: 'storeTiles'; id: string; title: string; items: Shop[] };

export interface Home {
  deliveryMins: number;
  /** The home delivery promise the admin typed, e.g. "19 minutes" or "Next day delivery". */
  deliveryText?: string;
  /** False when no shop delivers to the customer's pinned address yet. */
  serviceable: boolean;
  shopCount: number;
  topTabs: Category[];
  sections: HomeSection[];
  categories: Category[];
  popularProducts: Product[];
  newArrivals: Product[];
  shops: Shop[];
}

/* --------------------------------- account ------------------------------- */

export interface Address {
  id: string;
  label: 'home' | 'work' | 'other';
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  location?: { lat: number; lng: number };
  isDefault?: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  art: string;
  image?: string;
  unit?: string;
  price: number;
  mrp?: number;
  quantity: number;
  lineTotal: number;
  nameHi?: string;
  stock: number;
  /** Delivery promise in days for slow aisles; absent = same-day. */
  deliveryDays?: number | null;
  /** False in aisles where cash on delivery is switched off. */
  codAvailable?: boolean;
  /** False when the product can only be paid for in cash. */
  onlineAvailable?: boolean;
  issue?: string | null;
}

export interface CartGroup {
  shop: { id: string; name: string; slug: string; logo?: string; isOpen: boolean; minOrderAmount: number };
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  meetsMinOrder: boolean;
}

/** A product offered to top up the basket (the hidden points rule). */
export interface CartSuggestion {
  productId: string;
  name: string;
  slug: string;
  art: string;
  image?: string;
  unit?: string;
  price: number;
  mrp?: number;
}

export interface CartPoints {
  enabled: boolean;
  /** Checkout is open when true. The numbers behind it are never sent to the customer. */
  met: boolean;
  suggestions: CartSuggestion[];
  autoAddId: string | null;
}

export type SlotKey = 'instant' | 'twoHour' | 'nextDay';

/** What this basket costs to deliver to an address, from the admin's pricing rules. */
export type PayKey = 'upi' | 'cod' | 'debit' | 'netbanking' | 'credit' | 'rupay';
export interface PaymentOption {
  key: PayKey;
  label: string;
  note?: string;
  pct: number;
  highPct?: number;
  highFrom?: number;
}

export interface Quote {
  distanceKm: number | null;
  subtotal: number;
  minOrder: number;
  meetsMinOrder: boolean;
  handlingFee: number;
  baseDeliveryFee: number;
  deliveryFee: number;
  freeAbove: number;
  addForFree: number;
  twoHourFee: number;
  days: number;
  redOrder: boolean;
  longDistance: boolean;
  codAllowed: boolean;
  codMessage?: string;
  total: number;
  /** What each way to pay adds to this bill (#36). */
  paymentFees?: Partial<Record<PayKey, number>>;
}

export interface CartView {
  points: CartPoints;
  groups: CartGroup[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  hasIssues: boolean;
  freeDeliveryAbove: number;
  /** Only on a visitor's (not signed in) basket: the delivery bill for their chosen location. */
  quote?: Quote | null;
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export interface OrderItem {
  productId: string;
  name: string;
  art: string;
  image?: string;
  unit?: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  /** Delivery promise in days for slow aisles; absent = same-day. */
  deliveryDays?: number | null;
  status: OrderStatus;
  items: OrderItem[];
  address: Address;
  paymentMethod: 'cod' | 'online';
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryOtp?: string | null;
  note?: string;
  createdAt: string;
  shop?: Ref;
  /** Shown once the rider has the parcel. */
  rider?: { name: string; phone?: string };
  /** Rider's last reported position while out for delivery. */
  riderLocation?: { lat: number; lng: number; at?: string };
  /** Where the order is picked up, for the live map. */
  shopLocation?: { lat: number; lng: number };
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  /** The customer's GST number, printed under their name on bills. */
  gstin?: string;
}

/* ---------------- festival tab, care chat, notifications ---------------- */

export interface PublicSettings {
  festival: { enabled: boolean; name: string; banner?: string | null };
  appLinks: { android?: string; ios?: string; rider?: string; warehouse?: string };
  /** Social media pages the admin filled in (full https links only). */
  socialLinks?: Partial<Record<'facebook' | 'instagram' | 'youtube' | 'whatsapp' | 'x' | 'telegram' | 'linkedin', string>>;
  company?: { name?: string; logo?: string; tagline?: string };
  /** Extra pages the admin added: a name and a full link. */
  socialOther?: { label: string; url: string }[];
  sixDayDays: number;
  codMessage?: string;
  /** Daily cut-off after which cash on delivery is refused. */
  codCutoff?: { enabled: boolean; time: string; blocked: boolean; message: string };
  supportPhone?: string;
  /** Full-screen promo pages shown on a timer. */
  popup?: { enabled: boolean; intervalSeconds: number; pages: { image: string; link?: string | null }[] };
  /** Only the delivery times the admin left on, in order. */
  deliverySlots?: { key: SlotKey; label: string }[];
  twoHourCharge?: { enabled: boolean; amount: number };
  pricing?: { handlingFee: number; bands: { upToKm: number; minOrder: number; freeAbove: number; fee: number; nextDay: boolean; redOrder: boolean }[] };
  filters?: { key: string; label: string; kind: 'brand' | 'price' | 'discount' | 'rating' | 'diet' | 'stock' }[];
  priceSortEnabled?: boolean;
  googleReviewUrl?: string;
  /** All maps require the configured Google Maps key. */
  maps?: { provider: 'google'; googleMapsApiKey: string | null };
  /** True once the server has its Razorpay keys. */
  onlinePaymentOn?: boolean;
  /** #36: the ways to pay at checkout and their charge, as a percent of the bill. */
  paymentOptions?: PaymentOption[];
  /** Public sign-in client ids; null while that provider is not set up. */
  social?: { googleClientId: string | null; facebookAppId: string | null; instagramAppId?: string | null };
}

export interface FestivalSection {
  title: string;
  category: Category;
  items: Product[];
}

export interface FestivalPage {
  enabled: boolean;
  name: string;
  banner?: string | null;
  sections: FestivalSection[];
}

export interface Notice {
  id: string;
  message: string;
  createdAt: string;
}

export interface TicketMessage {
  from: 'customer' | 'admin';
  text: string;
  at: string;
}

export interface Ticket {
  id: string;
  query: string;
  phone: string;
  status: 'open' | 'closed';
  messages: TicketMessage[];
  customerUnread: number;
  lastMessageAt: string;
  createdAt: string;
}

/** One photo of the Gallery page or one video of the Videos page. */
export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  title: string;
  caption?: string;
  url: string;
  /** Video cover (a YouTube cover is filled in by the server). */
  thumbnail?: string;
  videoType?: 'youtube' | 'vimeo' | 'file';
  /** What to play: an iframe address for YouTube / Vimeo, the file link for a direct video. */
  embedUrl?: string;
}
