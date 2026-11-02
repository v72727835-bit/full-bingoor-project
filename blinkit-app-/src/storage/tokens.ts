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
