import type { FirebaseApp } from 'firebase/app';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { PublicSettings } from './types';

type FirebaseSettings = NonNullable<PublicSettings['firebase']>;

/**
 * Firebase on the website. The keys come from the super admin panel through the
 * public settings, so nothing is baked into the build.
 */
let app: FirebaseApp | null = null;
let appKey = '';

async function getApp(cfg: NonNullable<FirebaseSettings['config']>): Promise<FirebaseApp> {
  const key = JSON.stringify(cfg);
  if (app && appKey === key) return app;
  const { initializeApp, getApps, deleteApp } = await import('firebase/app');
  for (const a of getApps()) await deleteApp(a);
  app = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    messagingSenderId: cfg.messagingSenderId,
    storageBucket: cfg.storageBucket,
  });
  appKey = key;
  return app;
}

/** "9876543210" -> "+919876543210". */
export const toE164 = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return `+91${d.length > 10 ? d.slice(-10) : d}`;
};

export interface OtpSession {
  confirm: (code: string) => Promise<string>;
  cleanup: () => void;
}

/** Sends the SMS (invisible reCAPTCHA) and returns a handle to confirm the code, which resolves to a Firebase ID token. */
export async function startPhoneOtp(fb: FirebaseSettings, phone: string, containerId: string): Promise<OtpSession> {
  if (!fb.config) throw new Error('Phone verification is not set up yet.');
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
  const auth = getAuth(await getApp(fb.config));
  auth.languageCode = 'en';
  let verifier: RecaptchaVerifier | null = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  const cleanup = () => {
    try {
      verifier?.clear();
    } catch {
      /* already cleared */
    }
    verifier = null;
  };
  let result: ConfirmationResult;
  try {
    result = await signInWithPhoneNumber(auth, toE164(phone), verifier);
  } catch (e) {
    cleanup();
    throw new Error(otpErrorMessage(e));
  }
  return {
    confirm: async (code: string) => {
      try {
        const cred = await result.confirm(code.trim());
        return await cred.user.getIdToken(true);
      } catch (e) {
        throw new Error(otpErrorMessage(e));
      }
    },
    cleanup,
  };
}

function otpErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-phone-number')) return 'That phone number is not valid.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (code.includes('invalid-verification-code')) return 'That code is not correct. Please check the SMS and try again.';
  if (code.includes('code-expired') || code.includes('session-expired')) return 'That code has expired. Please request a new one.';
  if (code.includes('captcha')) return 'Could not verify that you are human. Please reload the page and try again.';
  if (code.includes('quota-exceeded')) return 'We cannot send more OTPs right now. Please try again later.';
  return 'Could not send the OTP. Please try again.';
}

/* ---------------- Push notifications ---------------- */

/** Asks permission, registers the browser with Firebase and returns its push token (null when unavailable). */
export async function getWebPushToken(fb: FirebaseSettings): Promise<string | null> {
  if (!fb.pushEnabled || !fb.config?.vapidKey || typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return null;
  const cfg = btoa(JSON.stringify(fb.config));
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?cfg=${encodeURIComponent(cfg)}`);
  const messaging = getMessaging(await getApp(fb.config));
  return (await getToken(messaging, { vapidKey: fb.config.vapidKey, serviceWorkerRegistration: reg })) || null;
}

/** Shows messages that arrive while the site is open (background ones are handled by the service worker). */
export async function onForegroundPush(fb: FirebaseSettings, handler: (m: { title: string; body: string; url?: string }) => void): Promise<() => void> {
  if (!fb.config) return () => undefined;
  const { isSupported, getMessaging, onMessage } = await import('firebase/messaging');
  if (!(await isSupported())) return () => undefined;
  return onMessage(getMessaging(await getApp(fb.config)), (p) =>
    handler({ title: p.notification?.title ?? 'Bingoor', body: p.notification?.body ?? '', url: p.data?.url }),
  );
}
