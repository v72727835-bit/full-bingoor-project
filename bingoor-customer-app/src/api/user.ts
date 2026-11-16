import { Address, AddressLabel, ApiEnvelope, ProductSummary, User } from '../types';
import { api } from './client';
import { syncPointFromAddresses } from '../store/deliveryPoint';

export interface AddressInput {
  label: AddressLabel;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  /** Exact pin the rider navigates to. */
  location?: { lat: number; lng: number };
  isDefault?: boolean;
}

export async function updateProfile(input: { name?: string; email?: string }): Promise<User> {
  const { data } = await api.patch<ApiEnvelope<User>>('/me', input);
  return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

/** Deletes the signed-in customer's account for good (password confirms it). */
export async function deleteMyAccount(password: string): Promise<void> {
  await api.delete('/me', { data: { password } });
}

/* ------------------------------------------------------------- addresses -- */

export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<ApiEnvelope<Address[]>>('/me/addresses');
  syncPointFromAddresses(data.data);
  return data.data;
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const { data } = await api.post<ApiEnvelope<Address>>('/me/addresses', input);
  return data.data;
}

export async function updateAddress(addressId: string, input: Partial<AddressInput>): Promise<Address> {
  const { data } = await api.patch<ApiEnvelope<Address>>(`/me/addresses/${addressId}`, input);
  return data.data;
}

export async function setDefaultAddress(addressId: string): Promise<Address[]> {
  const { data } = await api.patch<ApiEnvelope<Address[]>>(`/me/addresses/${addressId}/default`, {});
  syncPointFromAddresses(data.data);
  return data.data;
}

export async function deleteAddress(addressId: string): Promise<Address[]> {
  const { data } = await api.delete<ApiEnvelope<Address[]>>(`/me/addresses/${addressId}`);
  return data.data;
}

/* -------------------------------------------------------------- wishlist -- */

export async function fetchWishlist(): Promise<ProductSummary[]> {
  const { data } = await api.get<ApiEnvelope<ProductSummary[]>>('/me/wishlist');
  return data.data;
}

export async function addToWishlist(productId: string): Promise<void> {
  await api.post(`/me/wishlist/${productId}`, {});
}

export async function removeFromWishlist(productId: string): Promise<void> {
  await api.delete(`/me/wishlist/${productId}`);
}
