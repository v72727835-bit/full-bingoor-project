export interface ApiEnvelope<T> { success?: boolean; data: T; meta?: PageMeta }
export interface PageMeta { page: number; limit: number; total: number; totalPages: number; hasNext: boolean }
export interface Wh { _id: string; name: string }
export interface SellerUser { _id: string; name: string; phone: string; email?: string; role: string; sellerId?: string; sellerWarehouses?: Wh[] }
export interface AuthResult { user: SellerUser; accessToken: string; refreshToken: string }
export interface Me { user: SellerUser; stats: unknown }

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'rejected';
export interface OrderItem { product: string; name: string; unit: string; quantity: number; lineTotal: number }
export interface Order {
  _id: string; orderNumber: string; status: OrderStatus; paymentMethod: 'cod' | 'online'; paymentStatus: string;
  user?: { _id: string; name: string; phone: string } | string;
  shop?: { _id: string; name: string } | string;
  rider?: { _id: string; name: string; phone?: string } | string;
  /** Still waiting for a rider: riders linked to the warehouse, those who see it in their app, and those online. */
  riderPool?: { linked: number; canSee: number; online: number };
  longDistance?: boolean;
  fulfillment?: 'rider' | 'shiprocket';
  shiprocket?: { orderId?: string; awb?: string; courier?: string; status?: string };
  items: OrderItem[];
  address: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  subtotal: number; deliveryFee: number; discount: number; total: number; note?: string; createdAt: string;
}
export interface Product {
  _id: string; name: string; nameHi?: string; brand?: string; description?: string; images: string[]; video?: string; price: number; mrp: number;
  unit: string; stock: number; isActive: boolean; foodType: 'veg' | 'nonveg' | ''; attributes: string[]; tags: string[];
  variantGroup?: string; variantLabel?: string; hsn?: string; gstRate?: number | null; paymentMode?: 'both' | 'cod' | 'online'; category: { _id: string; name: string } | string; shop: { _id: string; name: string } | string;
}
export interface Category { _id: string; name: string; nameHi?: string; parent: string | null; level: 1 | 2 | 3 }
export interface Dashboard {
  orders: { byStatus: Record<string, number>; total: number };
  today: { orders: number; revenue: number };
  deliveredRevenue: number;
  trend: { date: string; orders: number; revenue: number }[];
  topProducts: { _id: string; name: string; qty: number; revenue: number }[];
  lowStock: { _id: string; name: string; stock: number; unit: string }[];
  outOfStock: number;
  products: { live: number; off: number };
  recent: { _id: string; orderNumber: string; status: string; total: number; createdAt: string; paymentMethod: string }[];
}
export interface Shop {
  _id: string; name: string; gstin?: string; description?: string; phone?: string; isOpen: boolean; deliveryRadiusKm: number; minOrderAmount: number; deliveryFee: number; logo?: string; banner?: string;
  address: { line1?: string; city?: string; state?: string; pincode?: string };
}
export interface Customer { _id: string; name: string; phone: string; orders: number; spent: number; last: string }
export interface WhRider { _id: string; name: string; phone: string; isActive: boolean; online: boolean; busy: boolean; paused: boolean; lastSeenAt?: string }
export interface OrderRider { _id: string; name: string; phone: string; state: string; free: boolean }
export interface OrderRiders { radiusKm: number | null; distanceKm: number | null; longDistance: boolean; riders: OrderRider[] }
