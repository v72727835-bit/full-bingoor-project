import { api } from '../lib/client';
import { getDeliveryPoint, setDeliveryPoint } from '../lib/deliveryPoint';
import * as n from '../lib/normalize';
import { Address, Product, RawProduct, UserProfile } from '../lib/types';

export const fetchMe = async (): Promise<UserProfile> => {
  const { data } = await api.get('/me');
  const raw = data.data;
  return { ...raw, id: raw._id ?? raw.id };
};

export const updateMe = async (body: { name?: string; email?: string; avatar?: string }): Promise<UserProfile> => {
  const { data } = await api.patch('/me', body);
  const raw = data.data;
  return { ...raw, id: raw._id ?? raw.id };
};

/** `remember: false` just reads the list, without choosing a delivery area from it. */
export const fetchAddresses = async (remember = true): Promise<Address[]> => {
  const { data } = await api.get('/me/addresses');
  const list = (data.data as Record<string, unknown>[]).map(n.address);
  // Keep the catalogue scoped to wherever the default address is pinned.
  const home = list.find((a) => a.isDefault && a.location) ?? list.find((a) => a.location);
  // Only when the visitor has not chosen a delivery area yet - never override their choice.
  if (remember && home?.location && !getDeliveryPoint()) setDeliveryPoint({ ...home.location, label: home.city });
  return list;
};

export type AddressInput = Omit<Address, 'id'>;

export const addAddress = async (body: AddressInput): Promise<Address> => {
  const { data } = await api.post('/me/addresses', body);
  return n.address(data.data);
};

export const updateAddress = async (id: string, body: Partial<AddressInput>): Promise<Address> => {
  const { data } = await api.patch(`/me/addresses/${id}`, body);
  return n.address(data.data);
};

export const setDefaultAddress = async (id: string): Promise<void> => {
  await api.patch(`/me/addresses/${id}/default`);
};

export const deleteAddress = async (id: string): Promise<void> => {
  await api.delete(`/me/addresses/${id}`);
};

export const fetchWishlist = async (): Promise<Product[]> => {
  const { data } = await api.get('/me/wishlist');
  const payload = data.data;
  const list: RawProduct[] = Array.isArray(payload) ? payload : (payload?.items ?? payload?.products ?? []);
  return list.map(n.product);
};

export const addToWishlist = async (productId: string): Promise<void> => {
  await api.post(`/me/wishlist/${productId}`);
};

export const removeFromWishlist = async (productId: string): Promise<void> => {
  await api.delete(`/me/wishlist/${productId}`);
};
