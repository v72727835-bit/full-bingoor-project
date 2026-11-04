export interface AdminUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'customer' | 'rider' | 'shop' | 'admin' | 'seller';
  warehouse?: string | { _id: string; name: string };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface Category {
  _id: string;
  name: string;
  nameHi?: string;
  slug: string;
  icon?: string;
  image?: string;
  tint?: string;
  parent: string | null;
  level: 1 | 2 | 3;
  sortOrder: number;
  isActive: boolean;
}

export interface Banner {
  _id: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  image: string;
  category?: { _id: string; name: string; slug: string } | string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Shop {
  _id: string;
  name: string;
  slug: string;
  gstin?: string;
  description?: string;
  phone?: string;
  address: { line1?: string; city?: string; state?: string; pincode?: string };
  location: { type: 'Point'; coordinates: [number, number] };
  isOpen: boolean;
  isActive: boolean;
  deliveryRadiusKm: number;
  minOrderAmount: number;
  deliveryFee: number;
  rating: number;
  createdAt: string;
}

export interface StandardCategory {
  _id: string;
  name: string;
  nameHi?: string;
  position: 'top' | 'bottom';
  sortOrder: number;
  isActive: boolean;
  products?: number;
}

export interface Product {
  _id: string;
  hsn?: string;
  gstRate?: number | null;
  paymentMode?: 'both' | 'cod' | 'online';
  standardCategories?: string[];
  name: string;
  slug: string;
  brand?: string;
  description?: string;
  images: string[];
  /** Optional video: an uploaded file or a YouTube / Vimeo link. */
  video?: string;
  icon?: string;
  price: number;
  mrp: number;
  unit: string;
  stock: number;
  attributes: string[];
  foodType: 'veg' | 'nonveg' | '';
  tags: string[];
  isActive: boolean;
  rating: number;
  ratingCount?: number;
  /** Shown instead of the rating count, e.g. "5L+". */
  ratingLabel?: string;
  /** Products sharing a group are sizes of one another. */
  variantGroup?: string;
  variantLabel?: string;
  soldCount: number;
  nameHi?: string;
  /** Hidden cart-points value (0-50) - customers never see it. */
  points?: number;
  /** Admin tick: show this product in the cart / checkout top-up (50-point) list. */
  cartFeatured?: boolean;
  /** Lower comes first; 1000000 (default) = A-Z after the sorted ones. */
  sortCode?: number | null;
  seller?: { _id: string; name: string; sellerId?: string; sellerProfile?: { firm?: string } } | string;
  shop: { _id: string; name: string } | string;
  category: { _id: string; name: string } | string;
  createdAt: string;
}

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

/**
 * Where an order may go next from the admin panel (mirrors the backend).
 * The store steps end at "ready for pickup"; a rider accepting the order is
 * what puts it out for delivery.
 */
export const ADMIN_NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
};

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

export interface Order {
  _id: string;
  orderNumber: string;
  user: { _id: string; name: string; phone: string; email?: string } | string;
  shop: { _id: string; name: string; phone?: string } | string;
  rider?: { _id: string; name: string; phone?: string } | string;
  /** Orders still waiting for a rider: riders linked to the warehouse, those who see it in the app, and those online. */
  riderPool?: { linked: number; canSee: number; online: number };
  longDistance?: boolean;
  fulfillment?: 'rider' | 'shiprocket';
  shiprocket?: { orderId?: string; shipmentId?: string; awb?: string; courier?: string; labelUrl?: string; status?: string; syncedAt?: string };
  items: OrderItem[];
  address: {
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentMethod: 'cod' | 'online';
  paymentStatus: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  note?: string;
  createdAt: string;
}

export interface AppUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'customer' | 'rider' | 'shop' | 'admin';
  warehouse?: string | { _id: string; name: string };
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TrendPoint {
  date: string;
  orders: number;
  revenue: number;
  delivered: number;
  cancelled: number;
}

export interface TopProduct {
  _id: string;
  name: string;
  soldCount: number;
  price: number;
  stock: number;
  unit: string;
  images: string[];
  icon?: string;
}

export interface LowStockProduct {
  _id: string;
  name: string;
  stock: number;
  unit: string;
  images: string[];
  icon?: string;
  shop?: { _id: string; name: string } | string;
}

export interface RoleCount {
  total: number;
  active: number;
}

export interface DashboardStats {
  products: { total: number; active: number; lowStock: number };
  categories: number;
  shops: number;
  customers: number;
  usersByRole: Record<string, RoleCount>;
  orders: { total: number; byStatus: Record<string, number> };
  revenue: number;
  today: { orders: number; revenue: number };
  yesterday: { orders: number; revenue: number };
  trend: TrendPoint[];
  topProducts: TopProduct[];
  lowStockList: LowStockProduct[];
  recentCustomers: { _id: string; name: string; phone: string; createdAt: string; lastLoginAt?: string }[];
  recentOrders: Order[];
}

export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  discountType: 'percent' | 'flat';
  value: number;
  maxDiscount: number;
  minOrderAmount: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  shops: ({ _id: string; name: string } | string)[];
  isActive: boolean;
  createdAt: string;
}

/* ---------------- settings, support, riders ---------------- */

export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
  level: 1 | 2 | 3;
}

export interface CompanyDetails {
  name?: string; tagline?: string; address?: string; phone?: string; email?: string; website?: string; gstin?: string; fssai?: string;
  logo?: string; signature?: string; seal?: string; signatoryName?: string; signatoryTitle?: string; declaration?: string; footerNote?: string;
}
export interface SocialLinks { facebook?: string; instagram?: string; youtube?: string; whatsapp?: string; x?: string; telegram?: string; linkedin?: string }

export interface Settings {
  festival: {
    enabled: boolean;
    /** Menu label customers see, e.g. "Rakhi" or "Diwali". */
    name: string;
    banner?: string;
    sections: { title: string; category: CategoryRef | string }[];
  };
  sixDay: { days: number; categories: (CategoryRef | string)[] };
  cod: { disabledCategories: (CategoryRef | string)[]; message: string };
  riderCodLimit: number;
  riderPay?: {
    enabled: boolean;
    baseFare: number;
    slabs: { maxKm: number; pay: number }[];
    perKmBeyond: number;
    minPerOrder: number;
    minWithdraw: number;
  };
  sellerPay?: {
    commissionPct: number;
    minWithdraw: number;
  };
  appLinks: { android?: string; ios?: string; rider?: string; warehouse?: string };
  company?: CompanyDetails;
  gst?: { defaultRate: number; deliveryRate: number; homeState: string };
  socialLinks?: SocialLinks;
  socialOther?: { label: string; url: string }[];
  imageMaxKb: number;
  supportPhone?: string;
  deliverySlots: { key: 'instant' | 'twoHour' | 'nextDay'; label: string; enabled: boolean }[];
  twoHourCharge: { enabled: boolean; amount: number };
  pricing: {
    handlingFee: number;
    bands: { upToKm: number; minOrder: number; freeAbove: number; fee: number; nextDay: boolean; redOrder: boolean }[];
    beyondDays: number;
    beyondMinOrder: number;
    beyondCodDisabled: boolean;
    beyondCodMessage: string;
    /** Point 37: the only categories a customer past the last row sees; empty = all. */
    beyondCategories?: string[];
    /** Point 37: standard-category (home) rows a far customer also sees. */
    beyondStandardCategories?: string[];
    /** Point 37: single products (e.g. Diwali menu) a far customer also sees. */
    beyondProducts?: string[];
  };
  filters: { key: string; label: string; kind: 'brand' | 'price' | 'discount' | 'rating' | 'diet' | 'stock'; enabled: boolean }[];
  priceSortEnabled: boolean;
  googleReviewUrl?: string;
  cartPoints: { enabled: boolean; target: number; suggestions: (string | { _id: string; name: string; unit?: string })[] };
  /** #36: ways to pay at checkout and their charge (percent of the bill). */
  paymentOptions?: { key: 'upi' | 'cod' | 'debit' | 'netbanking' | 'credit' | 'rupay'; label: string; note?: string; enabled: boolean; pct: number; highPct?: number; highFrom?: number }[];
}

export const ENQUIRY_LABELS: Record<string, string> = {
  city_manager: 'Contact with City manager',
  invest: 'Invest with us',
  delivery_partner: 'Delivery partner contact',
  seller: 'Sell your product with us',
  advertise: 'Advertise your brand',
  complaint: 'Complaint to City manager',
};

export interface Enquiry {
  _id: string;
  kind: string;
  fullName: string;
  email: string;
  mobile: string;
  otherPhone?: string;
  reason: string;
  createdAt: string;
}

export interface SellerProfile {
  firm: string;
  address: string;
  mobile: string;
  aadhaar?: string;
  pan?: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
  accountType: 'current' | 'savings';
  ifsc: string;
  locked: boolean;
  submittedAt: string;
}

export interface SellerRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  isActive: boolean;
  sellerId?: string;
  sellerProfile?: SellerProfile;
  sellerWarehouses?: { _id: string; name: string }[];
  sellerKind?: 'warehouse' | 'product';
  listings: number;
  createdAt: string;
}

export interface SellerStats {
  liveListings: number;
  totalListings: number;
  /** Orders with this seller's products that are not delivered yet. */
  liveOrders?: number;
  orders: number;
  revenue: number;
  unseenOrders: number;
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
  user: { _id: string; name: string; phone: string; email?: string } | string;
  phone: string;
  query: string;
  status: 'open' | 'closed';
  messages: TicketMessage[];
  adminUnread: number;
  customerUnread: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface StockAlert {
  _id: string;
  product: { _id: string; name: string; unit: string; stock: number; images?: string[]; icon?: string } | string;
  user?: { _id: string; name: string } | string;
  phone: string;
  notified: boolean;
  createdAt: string;
}

export interface RiderRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  warehouse?: { _id: string; name: string } | string;
  warehouses?: { _id: string; name: string }[];
  isActive: boolean;
  online: boolean;
  paused: boolean;
  lastSeenAt?: string | null;
  codPending: number;
  codCollected: number;
  /** COD cash collected today (India time). */
  codToday?: number;
  deliveredCount: number;
  cancelledCount: number;
  longDistance?: boolean;
}

export interface RiderTotals {
  totals: { codPending: number; codCollected: number; codToday?: number; online: number };
  codLimit: number;
}

export interface AdminAlert {
  _id: string;
  type: 'rider_paused' | 'warehouse_registered';
  message: string;
  rider?: { _id: string; name: string; email?: string } | string;
  read: boolean;
  createdAt: string;
}

export interface WarehouseApplication {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  sellerStatus: 'pending' | 'approved' | 'rejected';
  sellerRejectReason?: string;
  warehouseApplication?: {
    shopName: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    lat: number;
    lng: number;
    gst?: string;
    note?: string;
    submittedAt: string;
  };
  createdAt: string;
}

export interface MediaItem {
  _id: string;
  kind: 'photo' | 'video';
  title: string;
  caption?: string;
  url: string;
  thumbnail?: string;
  /** Videos only: how the website plays the link, and its cover. */
  videoType?: 'youtube' | 'vimeo' | 'file';
  embedUrl?: string;
  sortOrder: number;
  isActive: boolean;
}
