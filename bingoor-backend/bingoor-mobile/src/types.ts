export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
}

/** A delivery that is ringing this rider, from GET /rider/ring. */
export interface RingItem {
  dispatchId: string;
  kind: string;
  orderId?: string;
  bookingId?: string;
  since: string;
}

export interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  role: 'customer' | 'rider' | 'shop' | 'admin';
  warehouse?: { _id: string; name: string };
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

export interface ProductSummary {
  _id: string;
  name: string;
  slug: string;
  images: string[];
  price: number;
  mrp: number;
  unit: string;
  stock: number;
  rating: number;
  ratingCount: number;
  discountPercent: number;
  inStock: boolean;
  shop?: { _id: string; name: string; slug: string; isOpen: boolean };
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
  address?: { city?: string };
}

export interface HomeData {
  categories: Category[];
  popularProducts: ProductSummary[];
  newArrivals: ProductSummary[];
  shops: ShopSummary[];
}

/** The rider's own standing: cash in hand, counts, and the bell messages. */
export interface RiderProfile {
  _id: string;
  name: string;
  phone: string;
  warehouse?: { _id: string; name: string };
  warehouses?: { _id: string; name: string }[];
  codPending: number;
  codCollected: number;
  /** COD cash collected today (India time) and how many cash deliveries that was. */
  codToday?: number;
  codTodayDeliveries?: number;
  codLimit: number;
  deliveredCount: number;
  cancelledCount: number;
  paused: boolean;
  /** Rider plans are on and this rider has no running plan: no new orders until one is bought. */
  planNeeded?: boolean;
  notices: string[];
}

export interface MyPlan {
  required: boolean;
  active: boolean;
  until: string | null;
  daysLeft: number;
  plans: { _id: string; name: string; price: number; days: number; description?: string }[];
  canPayOnline: boolean;
}

export interface RiderOrder {
  _id: string;
  orderNumber: string;
  /** accepted / preparing: the warehouse is packing it; it can be taken once ready_for_pickup. */
  status: 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered';
  total: number;
  paymentMethod: 'cod' | 'online';
  createdAt: string;
  slot?: 'instant' | 'twoHour' | 'nextDay';
  deliveryDays?: number;
  /** 9-15 km: shown in red so the rider knows it is a longer run. */
  redOrder?: boolean;
  longDistance?: boolean;
  items: { name: string; quantity: number; price?: number; lineTotal: number }[];
  deliveredAt?: string;
  address: { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; location?: { lat: number; lng: number } };
  shop?: { name: string; phone?: string };
  user?: { name: string; phone: string };
}

export interface PayoutAccount {
  upi?: string;
  bankHolder?: string;
  bankNumber?: string;
  bankIfsc?: string;
}

export interface RiderWallet {
  balance: number;
  lifetimeEarned: number;
  pendingWithdraw: number;
  withdrawnTotal: number;
  codPending: number;
  codCollected: number;
  codLimit: number;
  minWithdraw: number;
  payEnabled: boolean;
  account: PayoutAccount | null;
}

export interface WalletTxn {
  _id: string;
  kind: 'earning' | 'bonus' | 'adjustment' | 'withdrawal' | 'cash_submit';
  amount: number;
  status: 'completed' | 'pending' | 'paid' | 'rejected' | 'confirmed';
  note?: string;
  km?: number;
  reference?: string;
  method?: 'upi' | 'bank';
  createdAt: string;
}

export interface EarningsSummary {
  series: { date: string; amount: number; deliveries: number }[];
  today: number;
  week: number;
  month: number;
  deliveries: number;
}
