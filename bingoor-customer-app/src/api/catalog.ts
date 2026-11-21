import {
  ApiEnvelope,
  Category,
  CategoryPage,
  HomeData,
  Paged,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  ReviewPage,
  ShopDetail,
  ShopSummary,
  Suggestion,
} from '../types';
import { api } from './client';

export async function fetchHome(): Promise<HomeData> {
  const { data } = await api.get<ApiEnvelope<HomeData>>('/home');
  return data.data;
}

export async function fetchCategories(all = false): Promise<Category[]> {
  const { data } = await api.get<ApiEnvelope<Category[]>>('/categories', {
    params: all ? { all: 'true' } : undefined,
  });
  return data.data;
}

/** The whole three-level tree in one call - what the Categories tab renders. */
export async function fetchCategoryTree(): Promise<Category[]> {
  const { data } = await api.get<ApiEnvelope<Category[]>>('/categories/tree');
  return data.data;
}

/** One tile's page: the category, its child rail and its neighbours. */
export async function fetchCategory(idOrSlug: string): Promise<CategoryPage> {
  const { data } = await api.get<ApiEnvelope<CategoryPage>>(`/categories/${idOrSlug}`);
  return data.data;
}

export async function fetchProducts(query: ProductQuery = {}): Promise<Paged<ProductSummary>> {
  const params: Record<string, string | number> = {};
  if (query.q) params.q = query.q;
  if (query.category) params.category = query.category;
  if (query.shop) params.shop = query.shop;
  if (query.brand) params.brand = query.brand;
  if (query.minPrice !== undefined) params.minPrice = query.minPrice;
  if (query.maxPrice !== undefined) params.maxPrice = query.maxPrice;
  if (query.inStock) params.inStock = 'true';
  if (query.sort) params.sort = query.sort;
  params.page = query.page ?? 1;
  params.limit = query.limit ?? 20;

  const { data } = await api.get<ApiEnvelope<ProductSummary[]>>('/products', { params });
  return { items: data.data, meta: data.meta };
}

export async function fetchProduct(idOrSlug: string, point?: { lat: number; lng: number } | null): Promise<ProductDetail> {
  const params = point ? { lat: point.lat, lng: point.lng } : undefined;
  const { data } = await api.get<ApiEnvelope<ProductDetail>>(`/products/${idOrSlug}`, params ? { params } : undefined);
  return data.data;
}

export async function suggestProducts(q: string): Promise<Suggestion[]> {
  const { data } = await api.get<ApiEnvelope<Suggestion[]>>('/products/suggest', { params: { q } });
  return data.data;
}

export async function fetchShops(params: { q?: string; page?: number; limit?: number } = {}): Promise<Paged<ShopSummary>> {
  const { data } = await api.get<ApiEnvelope<ShopSummary[]>>('/shops', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, ...(params.q ? { q: params.q } : {}) },
  });
  return { items: data.data, meta: data.meta };
}

export async function fetchShop(idOrSlug: string): Promise<ShopDetail> {
  const { data } = await api.get<ApiEnvelope<ShopDetail>>(`/shops/${idOrSlug}`);
  return data.data;
}

export async function fetchReviews(productId: string, page = 1): Promise<ReviewPage> {
  const { data } = await api.get<ApiEnvelope<ReviewPage>>(`/products/${productId}/reviews`, {
    params: { page, limit: 10 },
  });
  return data.data;
}

export async function submitReview(productId: string, rating: number, comment?: string): Promise<void> {
  await api.put(`/products/${productId}/reviews`, comment ? { rating, comment } : { rating });
}

/** #35 "See all products": every top-up (50-point) product, for the cart sheet. */
export async function fetchPointsProducts(): Promise<ProductSummary[]> {
  const { data } = await api.get<ApiEnvelope<ProductSummary[]>>('/cart/points-products');
  return data.data;
}

/** Brands inside an aisle (or everywhere), for the Brand filter - same list as the website. */
export async function fetchBrands(category?: string): Promise<string[]> {
  const { data } = await api.get<{ data: string[] }>('/products/brands', { params: category ? { category } : {} });
  return data.data ?? [];
}

/** The one warehouse an order to a pin comes from: how far, where, and when it arrives. */
export interface NearestWarehouse {
  distanceKm: number;
  lat?: number;
  lng?: number;
  isOpen: boolean;
  /** 0 = within 15 km (19 minutes), 1 = 15-30 km (next day), 3 = beyond 30 km. */
  deliveryDays: number;
  deliveryText: string;
}

export async function fetchNearestWarehouse(lat: number, lng: number): Promise<NearestWarehouse | null> {
  const { data } = await api.get<ApiEnvelope<{ nearest?: NearestWarehouse | null }>>('/coverage', {
    params: { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 },
  });
  return data.data.nearest ?? null;
}
