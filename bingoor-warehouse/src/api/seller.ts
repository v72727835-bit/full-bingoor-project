import { api } from './client';
import { ApiEnvelope, AuthResult, Category, Customer, Dashboard, Me, Order, OrderRiders, PageMeta, Product, Shop, WhRider } from '../types';

export interface Paged<T> { items: T[]; meta: PageMeta }
async function paged<T>(url: string, params?: Record<string, unknown>): Promise<Paged<T>> {
  const { data } = await api.get<ApiEnvelope<T[]>>(url, { params });
  return { items: data.data, meta: data.meta as PageMeta };
}

export async function sellerLogin(identifier: string, password: string): Promise<AuthResult> {
  const { data } = await api.post<ApiEnvelope<AuthResult>>('/seller/auth/login', { identifier, password });
  return data.data;
}
export async function logoutRequest(refreshToken: string | null): Promise<void> {
  await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
}
export const sellerMe = async (): Promise<Me> => (await api.get('/seller/me')).data.data;
export const sellerDashboard = async (): Promise<Dashboard> => (await api.get('/seller/dashboard')).data.data;

export const sellerOrders = (p: { page?: number; limit?: number; status?: string; q?: string }) => paged<Order>('/seller/orders', p);
export const setOrderStatus = async (id: string, status: string): Promise<void> => { await api.patch(`/seller/orders/${id}/status`, { status }); };
export const orderRiders = async (id: string): Promise<OrderRiders> => (await api.get(`/seller/orders/${id}/riders`)).data.data;
/** A short-lived link that opens the invoice (A4) or the thermal bill in the phone's browser, where it can be printed or saved as PDF. */
export const invoiceLinks = async (id: string): Promise<{ a4: string; pos: string }> => (await api.post(`/seller/orders/${id}/invoice-link`)).data.data;
export const assignRider = async (id: string, rider: string): Promise<void> => { await api.post(`/seller/orders/${id}/assign-rider`, { rider }); };
export const assignShiprocket = async (id: string): Promise<void> => { await api.post(`/seller/orders/${id}/assign-shiprocket`); };

export const sellerProducts = (p: { page?: number; limit?: number; q?: string; status?: string; category?: string }) => paged<Product>('/seller/products', p);
export const sellerCategories = async (): Promise<Category[]> => (await api.get('/seller/categories')).data.data;
export const createProduct = async (body: Record<string, unknown>): Promise<Product> => (await api.post('/seller/products', body)).data.data;
export const updateProduct = async (id: string, body: Record<string, unknown>): Promise<Product> => (await api.patch(`/seller/products/${id}`, body)).data.data;
export const deleteProduct = async (id: string): Promise<void> => { await api.delete(`/seller/products/${id}`); };
export async function uploadVideo(file: { uri: string; name: string; type: string }): Promise<string> {
  const form = new FormData();
  form.append('video', file as unknown as Blob);
  const { data } = await api.post('/seller/uploads/video', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  return (data.data?.url ?? data.data) as string;
}

export async function uploadImages(files: { uri: string; name: string; type: string }[]): Promise<string[]> {
  const form = new FormData();
  files.forEach((f) => form.append('images', f as unknown as Blob));
  const { data } = await api.post('/seller/uploads/images', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
  return data.data.urls;
}

export interface SellerWallet {
  balance: number; netEarned: number; grossSales: number; commissionTotal: number; pendingWithdraw: number; paidOut: number;
  minWithdraw: number; commissionPct: number;
  account: { upi?: string; bankHolder?: string; bankNumber?: string; bankIfsc?: string } | null;
}
export interface SellerTxnRow {
  _id: string; kind: 'earning' | 'adjustment' | 'withdrawal'; amount: number; status: string;
  gross?: number; commission?: number; note?: string; createdAt: string;
}
export const sellerWallet = async (): Promise<SellerWallet> => (await api.get('/seller/wallet')).data.data;
export const walletTxns = (p: { page?: number; limit?: number }) => paged<SellerTxnRow>('/seller/wallet/txns', p);
export const saveWalletAccount = async (body: { upi?: string; bankHolder?: string; bankNumber?: string; bankIfsc?: string }): Promise<void> => { await api.post('/seller/wallet/account', body); };
export const requestWithdraw = async (amount: number, method: 'upi' | 'bank'): Promise<void> => { await api.post('/seller/wallet/withdraw', { amount, method }); };

export const sellerRiders = async (): Promise<WhRider[]> => (await api.get('/seller/riders')).data.data;
export const createRider = async (body: { name: string; phone: string; password: string; warehouses?: string[] }): Promise<void> => { await api.post('/seller/riders', body); };
export const sellerCustomers = (p: { page?: number; limit?: number; q?: string }) => paged<Customer>('/seller/customers', p);
export const sellerShops = async (): Promise<Shop[]> => (await api.get('/seller/shops')).data.data;
export const updateShop = async (id: string, body: Record<string, unknown>): Promise<Shop> => (await api.patch(`/seller/shops/${id}`, body)).data.data;
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => { await api.post('/seller/change-password', { currentPassword, newPassword }); };

