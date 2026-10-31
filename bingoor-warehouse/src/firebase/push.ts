import { PermissionsAndroid, Platform } from 'react-native';
import { api } from '../api/client';

/**
 * Push notifications through Firebase Cloud Messaging (native SDK, loaded
 * lazily so a build without it still runs). The server sends the messages;
 * this only registers the phone and shows messages that arrive while the app is open.
 */
interface Messaging {
  requestPermission: () => Promise<number>;
  getToken: () => Promise<string>;
  deleteToken: () => Promise<void>;
  onTokenRefresh: (cb: (token: string) => void) => () => void;
  onMessage: (cb: (m: { notification?: { title?: string; body?: string } }) => void) => () => void;
}

function load(): (() => Messaging) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/messaging').default as () => Messaging;
  } catch {
    return null;
  }
}

let current: string | null = null;

async function post(token: string, app: 'warehouse') {
  current = token;
  await api.post('/devices', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', app });
}

/** Call after login. Returns a function that stops listening (call it on logout / unmount). */
export async function registerPush(app: 'warehouse', onForeground: (title: string, body: string) => void): Promise<() => void> {
  const messaging = load();
  if (!messaging) return () => undefined;
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return () => undefined;
    } else if (Platform.OS === 'ios') {
      await messaging().requestPermission();
    }
    await post(await messaging().getToken(), app);
    const offRefresh = messaging().onTokenRefresh((t) => void post(t, app).catch(() => undefined));
    const offMessage = messaging().onMessage((m) => onForeground(m.notification?.title ?? 'Bingoor', m.notification?.body ?? ''));
    return () => {
      offRefresh();
      offMessage();
    };
  } catch {
    return () => undefined; // push is a bonus: never block the app
  }
}

/** Call before logout so the next person on this phone does not get this account's notifications. */
export async function unregisterPush() {
  const messaging = load();
  try {
    if (current) await api.delete('/devices', { data: { token: current } });
    current = null;
    await messaging?.().deleteToken();
  } catch {
    /* ignore */
  }
}
