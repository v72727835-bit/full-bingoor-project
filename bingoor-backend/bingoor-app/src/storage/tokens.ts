import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'autozo_access_token';
const REFRESH_KEY = 'autozo_refresh_token';

// SecureStore has no web implementation, so fall back to localStorage there (dev only).
const isWeb = Platform.OS === 'web';

async function get(key: string): Promise<string | null> {
  try {
    if (isWeb) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  try {
    if (isWeb) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* nothing to delete */
  }
}

export const tokenStore = {
  getAccess: () => get(ACCESS_KEY),
  getRefresh: () => get(REFRESH_KEY),
  async save(accessToken: string, refreshToken: string) {
    await Promise.all([set(ACCESS_KEY, accessToken), set(REFRESH_KEY, refreshToken)]);
  },
  async clear() {
    await Promise.all([remove(ACCESS_KEY), remove(REFRESH_KEY)]);
  },
};
