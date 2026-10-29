/* Shapes returned by the Autozo API. Kept in one file so a backend change
 * shows up as a compile error rather than a blank screen. */

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
}

export interface Paged<T> {
  items: T[];
  meta?: PageMeta;
}

/* ------------------------------------------------------------------ user -- */

export type AddressLabel = 'home' | 'work' | 'other';

export interface Address {
  _id: string;
  label: AddressLabel;
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

export interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  role: 'customer' | 'rider' | 'shop' | 'admin';
  addresses?: Address[];
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/* --------------------------------------------------------------- catalog -- */

export interface Category {
  _id: string;
  name: string;
  /** Hindi name typed in the admin; shown when the app is set to Hindi. */
  nameHi?: string;
  slug: string;
  /** Key into the app's bundled artwork, e.g. 'carrot'. */
  icon?: string;
  image?: string;
  /** Pastel the tile is painted with; adapted for dark mode by `tint()`. */
  tint?: string;
  parent?: string | null;
  /** 1 group, 2 category tile, 3 the child rail on a listing page. */
  level?: 1 | 2 | 3;
  children?: Category[];
  /** One-word label for the home tab strip, e.g. "Grocery". */
  short?: string;
}

/** What a category page needs: itself, its children, and its neighbours. */
export interface CategoryPage extends Category {
  parent?: string | null;
  parentCategory?: Category | null;
  children: Category[];
  siblings: Category[];
}

export interface ProductSummary {
  _id: string;
  name: string;
  nameHi?: string;
  slug: string;
  brand?: string;
  images: string[];
  /** Bundled artwork key, used whenever `images` is empty. */
  icon?: string;
  /** Short chips under the name: 'Cotton', 'Spicy', 'SPF 50'. */
  attributes?: string[];
  /** Drives the green/brown food marker; empty for non-food. */
  foodType?: 'veg' | 'nonveg' | '';
  price: number;
  mrp: number;
  unit: string;
  stock: number;
  rating: number;
  ratingCount: number;
  /** The admin's own badge beside the stars, e.g. "5L+". */
  ratingLabel?: string;
  /** Delivery promise in days for slow aisles; null means same-day. */
  deliveryDays?: number | null;
  /** False in aisles where the admin switched cash on delivery off. */
  codAvailable?: boolean;
  /** False when the product can only be paid for in cash. */
  onlineAvailable?: boolean;
  discountPercent: number;
  inStock: boolean;
  shop?: { _id: string; name: string; slug: string; isOpen: boolean };
  category?: string | { _id: string; name: string; slug: string };
}

export interface ProductDetail extends Omit<ProductSummary, 'shop' | 'category'> {
  description?: string;
  brand?: string;
  soldCount?: number;
  shop?: {
    _id: string;
    name: string;
    slug: string;
    logo?: string;
    isOpen: boolean;
    deliveryFee: number;
    minOrderAmount: number;
    deliveryRadiusKm?: number;
    rating?: number;
  };
  category?: { _id: string; name: string; slug: string };
  /** Other sizes of the same item - each one its own product. */
  variants?: ProductVariant[];
  related: ProductSummary[];
}

export interface ProductVariant {
  _id: string;
  slug: string;
  label: string;
  price: number;
  mrp?: number;
  inStock: boolean;
}

export interface ShopSummary {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  description?: string;
  isOpen: boolean;
  rating: number;
  ratingCount: number;
  deliveryFee: number;
  minOrderAmount: number;
  deliveryRadiusKm?: number;
  address?: { line1?: string; city?: string; state?: string; pincode?: string };
}

export interface ShopDetail extends ShopSummary {
  phone?: string;
  categories: Category[];
}

/* The home feed is a list of typed sections, so the shop can re-merchandise
 * itself from the server without anyone shipping a new build. */
export interface SectionBase {
  id: string;
  title?: string;
  /** Hindi heading for group and standard-category strips. */
  titleHi?: string;
  subtitle?: string;
  tint?: string;
  /** Which top tab this strip belongs to; missing means "whole shop". */
  groupSlug?: string;
  /** Special treatment: 'deals' gets the dark band, 'trending' the warm one. */
  style?: 'deals' | 'trending';
}

export interface Banner {
  id: string;
  /** Text is optional on banners uploaded from the admin panel. */
  title?: string;
  subtitle?: string;
  cta?: string;
  icon?: string;
  /** Uploaded artwork; when set it fills the whole slide. */
  image?: string;
  /** Gradient stops, painted diagonally. */
  from?: string;
  to?: string;
  /** Missing when the banner links to every category. */
  slug?: string;
  categoryName?: string;
}
export interface BannerCarouselSection extends SectionBase {
  type: 'bannerCarousel';
  items: Banner[];
}
export interface CircleRailSection extends SectionBase {
  type: 'circleRail';
  items: Category[];
}
export interface CategoryGridSection extends SectionBase {
  type: 'categoryGrid';
  items: Category[];
}
export interface ProductRailSection extends SectionBase {
  type: 'productRail';
  seeAllSlug?: string;
  items: ProductSummary[];
}
export interface ProductGridSection extends SectionBase {
  type: 'productGrid';
  items: ProductSummary[];
}
export interface StoreTilesSection extends SectionBase {
  type: 'storeTiles';
  items: ShopSummary[];
}
export type HomeSection =
  | BannerCarouselSection
  | CircleRailSection
  | CategoryGridSection
  | ProductRailSection
  | ProductGridSection
  | StoreTilesSection;

export interface HomeData {
  deliveryMins: number;
  /** The home delivery promise as the admin typed it: "19 minutes", "2 hours", "Next day delivery". */
  deliveryText?: string;
  /** False when no shop delivers to the customer's pinned address yet. */
  serviceable?: boolean;
  shopCount: number;
  topTabs: Category[];
  sections: HomeSection[];
  /** Kept for older screens that still read the flat lists. */
  categories: Category[];
  popularProducts: ProductSummary[];
  newArrivals: ProductSummary[];
  shops: ShopSummary[];
}

export interface Suggestion {
  _id: string;
  name: string;
  slug: string;
  brand?: string;
  images: string[];
  icon?: string;
  price: number;
}

export type ProductSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating';

export interface ProductQuery {
  q?: string;
  category?: string;
  shop?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

/* ------------------------------------------------------------------ cart -- */

export type CartIssue = 'unavailable' | 'out_of_stock' | 'insufficient_stock' | null;

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  icon?: string;
  unit: string;
  price: number;
  mrp: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  deliveryDays?: number | null;
  codAvailable?: boolean;
  /** False when the product can only be paid for in cash. */
  onlineAvailable?: boolean;
  issue: CartIssue;
}

export interface CartGroup {
  shop: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    isOpen: boolean;
    minOrderAmount: number;
  };
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  meetsMinOrder: boolean;
}

export interface CartView {
  groups: CartGroup[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  hasIssues: boolean;
  freeDeliveryAbove: number;
  /** Set when the server trimmed a quantity, e.g. only 3 left in stock. */
  notice?: string;
  /** #35 hidden cart-points rule: checkout opens once `met`; the rows offer products that close the gap. */
  points?: {
    enabled: boolean;
    met: boolean;
    autoAddId: string | null;
    suggestions: { productId: string; name: string; slug: string; image?: string | null; icon?: string; unit?: string; price: number; mrp?: number }[];
  };
}

/* ---------------------------------------------------------------- orders -- */

export const ORDER_STATUSES = [
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PaymentMethod = 'cod' | 'online';
/** #36: the six ways to pay at checkout. */
export type PayKey = 'upi' | 'cod' | 'debit' | 'netbanking' | 'credit' | 'rupay';
export interface PayOptionInfo {
  key: PayKey;
  label: string;
  note?: string;
  pct: number;
  highPct?: number;
  highFrom?: number;
}
/** The delivery bill for the cart to one address (GET /cart/quote). */
export interface CartQuote {
  subtotal: number;
  handlingFee: number;
  deliveryFee: number;
  baseDeliveryFee: number;
  twoHourFee: number;
  total: number;
  days: number;
  codAllowed: boolean;
  codMessage?: string;
  paymentFees?: Partial<Record<PayKey, number>>;
}
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded';

export interface OrderItem {
  product: string;
  name: string;
  image?: string;
  icon?: string;
  unit: string;
  price: number;
  mrp: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  location?: { lat: number; lng: number };
}

export interface Order {
  _id: string;
  orderNumber: string;
  checkoutId: string;
  shop: { _id: string; name: string; slug: string; logo?: string; phone?: string };
  rider?: { _id: string; name: string; phone: string; avatar?: string };
  /** Rider's last reported position while out for delivery. */
  riderLocation?: { lat: number; lng: number; at?: string };
  items: OrderItem[];
  address: OrderAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory?: { status: OrderStatus; at: string; note?: string }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  note?: string;
  /** Promised days where the aisle is on the slower schedule. */
  deliveryDays?: number | null;
  deliveryOtp?: string;
  cancelledBy?: 'customer' | 'shop' | 'admin';
  cancelReason?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Starting an online payment: the order is only made after the payment is paid and verified. */
export interface PaymentRequired {
  requiresPayment: true;
  razorpayOrderId: string;
  amount: number;
  keyId: string;
}

export interface PlaceOrderResult {
  checkoutId: string;
  orders: Order[];
  grandTotal: number;
}

/** Why the server refused a checkout - shown to the user line by line. */
export interface CheckoutProblem {
  shop?: string;
  productId?: string;
  name?: string;
  reason: string;
}

/* --------------------------------------------------------------- reviews -- */

export interface Review {
  _id: string;
  rating: number;
  comment?: string;
  user?: { _id: string; name: string; avatar?: string };
  createdAt: string;
}

export interface ReviewPage {
  reviews: Review[];
  breakdown: Record<string, number>;
}


/* ------------------------- festival, care, notices ------------------------ */

/** Shop-wide switches the admin owns, fetched once at start-up. */
export interface PublicSettings {
  festival: { enabled: boolean; name: string; banner?: string | null };
  appLinks: { android?: string; ios?: string };
  /** Social pages the admin filled in (full https links only), plus any extra ones with a name. */
  socialLinks?: Partial<Record<'facebook' | 'instagram' | 'youtube' | 'whatsapp' | 'x' | 'telegram' | 'linkedin', string>>;
  socialOther?: { label: string; url: string }[];
  sixDayDays: number;
  codMessage?: string;
  /** True once the admin saved Razorpay keys. */
  onlinePaymentOn?: boolean;
  paymentOptions?: PayOptionInfo[];
  /** Public sign-in ids; null while that provider is not set up. */
  social?: { googleClientId: string | null; facebookAppId: string | null };
  deliverySlots?: { key: 'instant' | 'twoHour' | 'nextDay'; label: string }[];
}

export interface FestivalSection {
  title: string;
  category: Category;
  items: ProductSummary[];
}

export interface FestivalPage {
  enabled: boolean;
  name: string;
  banner?: string | null;
  sections: FestivalSection[];
}

export interface Notice {
  _id: string;
  message: string;
  createdAt: string;
}

export interface TicketMessage {
  from: 'customer' | 'admin';
  text: string;
  at: string;
}

export interface Ticket {
  _id: string;
  query: string;
  phone: string;
  status: 'open' | 'closed';
  messages: TicketMessage[];
  customerUnread: number;
  lastMessageAt: string;
  createdAt: string;
}
