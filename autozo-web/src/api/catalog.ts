import { api } from '../lib/client';
import axios from 'axios';
import { createCatalogResource } from '../lib/catalogResource';
import { pointParams } from '../lib/deliveryPoint';
import * as n from '../lib/normalize';
import {
  Category,
  FestivalPage,
  Home,
  MediaItem,
  Notice,
  Product,
  PublicSettings,
  RawCategory,
  RawProduct,
  RawShop,
  Shop,
} from '../lib/types';

export const homeLocationKey = () => JSON.stringify(pointParams() ?? {});
const homeResource = createCatalogResource<Home>(async (key) => {
  const params = JSON.parse(key) as Record<string, number>;
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await api.get('/home', { params: { lat: params.lat, lng: params.lng } });
      return n.home(data.data);
    } catch (error) {
      const transient = axios.isAxiosError(error) && (!error.response || [502, 503, 504].includes(error.response.status));
      if (!transient || attempt >= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 400));
    }
  }
});
export const fetchHome = (key = homeLocationKey(), force = false): Promise<Home> => homeResource(key, force);

export const fetchCategories = async (): Promise<Category[]> => {
  const { data } = await api.get('/categories');
  return (data.data as RawCategory[]).map(n.category);
};

export const fetchCategoryTree = async (): Promise<Category[]> => {
  const { data } = await api.get('/categories/tree');
  return (data.data as RawCategory[]).map(n.category);
};

export const fetchCategory = async (idOrSlug: string): Promise<Category> => {
  const { data } = await api.get(`/categories/${idOrSlug}`);
  return n.category(data.data);
};

export interface ListProductsParams {
  q?: string;
  category?: string;
  shop?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  minRating?: number;
  minDiscount?: number;
  foodType?: 'veg' | 'nonveg';
  sort?: 'relevance' | 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'name';
  page?: number;
  limit?: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export const listProducts = async (
  params: ListProductsParams,
): Promise<{ items: Product[]; meta: PageMeta }> => {
  const { data } = await api.get('/products', { params });
  return { items: (data.data as RawProduct[]).map(n.product), meta: data.meta };
};

export const suggestProducts = async (q: string): Promise<Product[]> => {
  if (!q.trim()) return [];
  const { data } = await api.get('/products/suggest', { params: { q } });
  return (data.data as RawProduct[]).map(n.product);
};

export const fetchProduct = async (idOrSlug: string): Promise<Product> => {
  const { data } = await api.get(`/products/${idOrSlug}`);
  return n.product(data.data);
};

export const fetchShops = async (): Promise<Shop[]> => {
  const { data } = await api.get('/shops');
  return (data.data as RawShop[]).map(n.shop);
};

export const fetchShop = async (idOrSlug: string): Promise<Shop> => {
  const { data } = await api.get(`/shops/${idOrSlug}`);
  return n.shop(data.data);
};

export const submitReview = async (productId: string, rating: number, comment?: string) => {
  await api.put(`/products/${productId}/reviews`, { rating, comment });
};

export const deleteReview = async (reviewId: string) => {
  await api.delete(`/reviews/${reviewId}`);
};

/** The festival tab (Rakhi, Diwali, …): banner plus rows of products. */
export const fetchFestival = async (): Promise<FestivalPage> => {
  const { data } = await api.get('/festival');
  return n.festival(data.data);
};

/** Shop-wide bits the client needs at start-up: festival tab name, app links. */
export const fetchPublicSettings = async (): Promise<PublicSettings> => {
  const { data } = await api.get('/settings/public');
  return data.data as PublicSettings;
};

/** Photos for the Gallery page and videos for the Videos page, as arranged in the super admin. */
export const fetchGallery = async (): Promise<MediaItem[]> => {
  const { data } = await api.get('/gallery');
  return (data.data as Record<string, unknown>[]).map(n.media);
};
export const fetchVideos = async (): Promise<MediaItem[]> => {
  const { data } = await api.get('/videos');
  return (data.data as Record<string, unknown>[]).map(n.media);
};

/** Announcements for the notification bell. */
export const fetchNotices = async (): Promise<Notice[]> => {
  const { data } = await api.get('/notices');
  return (data.data as Record<string, unknown>[]).map(n.notice);
};

/** "Notify me" when an out-of-stock product is back. */
export const notifyWhenBack = async (productId: string, phone: string): Promise<string> => {
  const { data } = await api.post(`/products/${productId}/notify`, { phone });
  return (data.data as { message: string }).message;
};

/** Brands sold in an aisle, for the Brand filter. */
export const fetchBrands = async (category?: string): Promise<string[]> => {
  const { data } = await api.get('/products/brands', { params: { category } });
  return data.data as string[];
};

export interface Coverage {
  serviceable: boolean;
  warehouses: { name: string; distanceKm: number; isOpen: boolean }[];
}

/** Does any warehouse deliver to this point? */
export const fetchCoverage = async (lat: number, lng: number): Promise<Coverage> => {
  const { data } = await api.get('/coverage', { params: { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 } });
  return data.data as Coverage;
};

/** #35 "See all" under the cart: the products the admin picked for the cart rows, in their sort-code order. */
export const fetchPointsProducts = async (): Promise<Product[]> => {
  const { data } = await api.get('/cart/points-products');
  return ((data.data ?? []) as RawProduct[]).map(n.product);
};
