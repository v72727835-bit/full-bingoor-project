import 'react-native-get-random-values';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { WEB_URL } from '../config';

/** Provider login stays in the system browser; only a one-time code comes back. */
export async function mobileLoginCode(provider: 'facebook' | 'instagram', appId: string) {
  const bytes = new Uint8Array(32);
  (globalThis as unknown as { crypto: { getRandomValues: (array: Uint8Array) => Uint8Array } }).crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
  const redirectUri = `${WEB_URL}/auth/mobile/${provider}`;
  const callback = `bingoor://auth/${provider}`;
  const query = [
    ['client_id', appId], ['redirect_uri', redirectUri], ['response_type', 'code'], ['state', state],
    ['scope', provider === 'facebook' ? 'public_profile,email' : 'instagram_business_basic'],
  ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  const url = `${provider === 'facebook' ? 'https://www.facebook.com/v23.0/dialog/oauth' : 'https://www.instagram.com/oauth/authorize'}?${query}`;
  if (!(await InAppBrowser.isAvailable())) throw new Error('Please update Chrome to continue with this login.');
  const result = await InAppBrowser.openAuth(url, callback, { ephemeralWebSession: true, showTitle: true });
  if (result.type !== 'success' || !result.url.startsWith(`${callback}?`)) throw new Error('Sign-in was closed.');
  const values = Object.fromEntries(result.url.split('?')[1].split('&').map((pair) => {
    const at = pair.indexOf('='); return [decodeURIComponent(pair.slice(0, at)), decodeURIComponent(pair.slice(at + 1))];
  }));
  if (values.state !== state || !values.code || values.error) throw new Error('Sign-in could not be verified. Please try again.');
  return { code: values.code, redirectUri };
}
