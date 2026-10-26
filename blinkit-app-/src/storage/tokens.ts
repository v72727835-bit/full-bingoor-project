import * as Keychain from 'react-native-keychain';

// Tokens live in the Android Keystore / iOS Keychain (encrypted, per-app).
const ACCESS_SERVICE = 'com.bingoor.app.access';
const REFRESH_SERVICE = 'com.bingoor.app.refresh';

async function get(service: string): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service });
    return credentials ? credentials.password : null;
  } catch {
    return null;
  }
}

async function set(service: string, value: string): Promise<void> {
  await Keychain.setGenericPassword('token', value, { service });
}

async function remove(service: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service });
  } catch {
    /* nothing to delete */
  }
}

export const tokenStore = {
  getAccess: () => get(ACCESS_SERVICE),
  getRefresh: () => get(REFRESH_SERVICE),
  async save(accessToken: string, refreshToken: string) {
    await Promise.all([set(ACCESS_SERVICE, accessToken), set(REFRESH_SERVICE, refreshToken)]);
  },
  async clear() {
    await Promise.all([remove(ACCESS_SERVICE), remove(REFRESH_SERVICE)]);
  },
};

/*
 * Small non-secret values that must survive a restart. The app has no other
 * storage library, so these ride in the keychain too (one entry each).
 */
const GUEST_SERVICE = 'com.bingoor.app.guest';
const GUEST_CART_SERVICE = 'com.bingoor.app.guestcart';
const USER_SERVICE = 'com.bingoor.app.user';

export const localStore = {
  /** "1" once the visitor chose to look around without an account. */
  getGuest: () => get(GUEST_SERVICE),
  setGuest: (on: boolean) => (on ? set(GUEST_SERVICE, '1') : remove(GUEST_SERVICE)),
  /** The visitor's basket as JSON: [{ productId, quantity }]. */
  getGuestCart: () => get(GUEST_CART_SERVICE),
  setGuestCart: (json: string | null) => (json ? set(GUEST_CART_SERVICE, json) : remove(GUEST_CART_SERVICE)),
  /**
   * The last known signed-in profile as JSON. Used only to keep the customer
   * logged in across a cold start when the server is briefly unreachable (e.g. a
   * Render cold start) instead of bouncing them to the login screen (F-05).
   */
  getUser: () => get(USER_SERVICE),
  setUser: (json: string | null) => (json ? set(USER_SERVICE, json) : remove(USER_SERVICE)),
};
