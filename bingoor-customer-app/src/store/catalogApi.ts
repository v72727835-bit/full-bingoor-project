import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  fetchCategory,
  fetchCategoryTree,
  fetchHome,
  fetchProduct,
  fetchProducts,
} from '../api/catalog';
import { fetchFestival, fetchNotices, fetchPublicSettings } from '../api/support';
import { getErrorMessage } from '../api/client';
import type {
  Category,
  CategoryPage,
  FestivalPage,
  HomeData,
  Notice,
  Paged,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  PublicSettings,
} from '../types';

/**
 * Catalogue data, cached in the Redux store with RTK Query.
 *
 * Every screen used to fetch on mount and throw the result away on unmount,
 * so going back to Home or re-opening an aisle meant a spinner and a fresh
 * round trip each time. Here each response is kept for a few minutes and
 * shared: a second screen asking for the same thing gets it instantly, two
 * screens asking at once share one request, and pull-to-refresh refetches.
 *
 * Requests still go through the existing axios client, so auth headers and
 * token refresh behave exactly as before.
 */
async function run<T>(
  load: () => Promise<T>,
): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await load() };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export const catalogApi = createApi({
  reducerPath: 'catalog',
  baseQuery: fakeBaseQuery<string>(),
  keepUnusedDataFor: 300,
  endpoints: build => ({
    // The argument is the delivery-point key: it does not change the request
    // (the client adds the pin) but gives each area its own cache entry.
    home: build.query<HomeData, string>({ queryFn: () => run(fetchHome) }),
    // Like home: the area key only gives each delivery area its own cache entry (the client adds the pin),
    // because a customer far from every warehouse sees a shorter list of categories.
    categoryTree: build.query<Category[], string>({
      queryFn: () => run(fetchCategoryTree),
    }),
    category: build.query<CategoryPage, { slug: string; at?: string }>({
      queryFn: ({ slug }) => run(() => fetchCategory(slug)),
    }),
    products: build.query<Paged<ProductSummary>, ProductQuery & { at?: string }>({
      queryFn: ({ at: _area, ...q }) => run(() => fetchProducts(q)),
    }),
    product: build.query<ProductDetail, { id: string; at?: string; point?: { lat: number; lng: number } | null }>({
      queryFn: ({ id, point }) => run(() => fetchProduct(id, point)),
      // Stock and price move; a product page should not be minutes old.
      keepUnusedDataFor: 60,
    }),
    // The festival switch decides whether a whole tab exists, so it is read
    // once at start-up and shared by the tab bar and the screen.
    publicSettings: build.query<PublicSettings, void>({
      queryFn: () => run(fetchPublicSettings),
    }),
    festival: build.query<FestivalPage, string>({
      queryFn: () => run(fetchFestival),
    }),
    notices: build.query<Notice[], void>({
      queryFn: () => run(fetchNotices),
      keepUnusedDataFor: 60,
    }),
  }),
});

export const {
  useHomeQuery,
  useCategoryTreeQuery,
  useCategoryQuery,
  useProductsQuery,
  useProductQuery,
  usePublicSettingsQuery,
  useFestivalQuery,
  useNoticesQuery,
} = catalogApi;
