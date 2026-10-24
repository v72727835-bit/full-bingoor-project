export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
}

export interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  role: 'customer' | 'rider' | 'shop' | 'admin';
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
