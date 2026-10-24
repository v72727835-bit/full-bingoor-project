import { ApiEnvelope, EarningsSummary, PayoutAccount, RiderOrder, RiderProfile, RiderWallet, WalletTxn } from '../types';
import { api } from './client';

export async function fetchRiderOrders(status?: 'ready_for_pickup' | 'out_for_delivery' | 'delivered'): Promise<RiderOrder[]> {
  const { data } = await api.get<ApiEnvelope<RiderOrder[]>>('/rider/orders', { params: { page: 1, limit: 50, status } });
  return data.data;
}

/** Cash in hand, delivered and cancelled counts, and the bell messages. */
export async function fetchRiderProfile(): Promise<RiderProfile> {
  const { data } = await api.get<ApiEnvelope<RiderProfile>>('/rider/me');
  return data.data;
}

export async function acceptRiderOrder(id: string): Promise<RiderOrder> {
  const { data } = await api.post<ApiEnvelope<RiderOrder>>(`/rider/orders/${id}/accept`);
  return data.data;
}

/** Live position while carrying a parcel, so the customer can follow the delivery. */
export async function sendRiderLocation(lat: number, lng: number): Promise<void> {
  await api.post('/rider/location', { lat, lng });
}

export async function deliverRiderOrder(id: string, otp: string): Promise<RiderOrder> {
  const { data } = await api.post<ApiEnvelope<RiderOrder>>(`/rider/orders/${id}/deliver`, { otp });
  return data.data;
}

/** Hands an accepted order back to the pickup pool. Counted against the rider. */
export async function cancelRiderOrder(id: string, reason?: string): Promise<RiderOrder> {
  const { data } = await api.post<ApiEnvelope<RiderOrder>>(
    `/rider/orders/${id}/cancel`,
    reason ? { reason } : {},
  );
  return data.data;
}

/* ---------------- earnings wallet ---------------- */

export async function fetchWallet(): Promise<RiderWallet> {
  const { data } = await api.get<ApiEnvelope<RiderWallet>>('/rider/wallet');
  return data.data;
}

export async function fetchWalletTxns(page = 1, kind?: WalletTxn['kind']): Promise<WalletTxn[]> {
  const { data } = await api.get<ApiEnvelope<WalletTxn[]>>('/rider/wallet/txns', { params: { page, limit: 30, kind } });
  return data.data;
}

export async function fetchEarnings(days = 14): Promise<EarningsSummary> {
  const { data } = await api.get<ApiEnvelope<EarningsSummary>>('/rider/earnings', { params: { days } });
  return data.data;
}

export async function savePayoutAccount(body: PayoutAccount): Promise<PayoutAccount> {
  const { data } = await api.post<ApiEnvelope<PayoutAccount>>('/rider/wallet/account', body);
  return data.data;
}

export async function requestWithdraw(amount: number, method: 'upi' | 'bank'): Promise<WalletTxn> {
  const { data } = await api.post<ApiEnvelope<WalletTxn>>('/rider/wallet/withdraw', { amount, method });
  return data.data;
}

export async function submitCash(amount?: number): Promise<WalletTxn> {
  const { data } = await api.post<ApiEnvelope<WalletTxn>>('/rider/wallet/cash-submit', amount ? { amount } : {});
  return data.data;
}
