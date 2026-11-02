import { ApiEnvelope, HomeData, ProductSummary } from '../types';
import { api } from './client';

export async function fetchHome(): Promise<HomeData> {
  const { data } = await api.get<ApiEnvelope<HomeData>>('/home');
  return data.data;
}

export async function searchProducts(q: string): Promise<ProductSummary[]> {
  const { data } = await api.get<ApiEnvelope<ProductSummary[]>>('/products', {
    params: { q, limit: 30 },
  });
  return data.data;
}
