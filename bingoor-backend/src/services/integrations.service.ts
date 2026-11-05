import { env } from '../config/env';
import { Integrations } from '../models/Integrations';
import { open } from '../utils/secretBox';
import { FACEBOOK_APP_ID, GOOGLE_CLIENT_ID, INSTAGRAM_APP_ID } from '../utils/socialIds';

/** What the server uses right now: the admin panel's values, falling back to the .env file. */
export interface LiveIntegrations {
  googleClientId?: string;
  facebookAppId?: string;
  facebookAppSecret?: string;
  instagramAppId?: string;
  instagramAppSecret?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  razorpayEnabled: boolean;
  /** Google Maps JS API key (client-side). Required for maps; no alternative provider is used. */
  googleMapsApiKey?: string;
  shiprocket: {
    email?: string;
    password?: string;
    pickupLocation?: string;
    channelId?: string;
    enabled: boolean;
  };
  razorpayx: {
    accountNumber?: string;
    keyId?: string;
    keySecret?: string;
    enabled: boolean;
    autoPayout: boolean;
  };
}

const TTL_MS = 15_000;
let cache: { at: number; value: LiveIntegrations } | null = null;

const wellFormed = (v: string | undefined, shape: RegExp) => (v && shape.test(v.trim()) ? v.trim() : undefined);

const safeOpen = (s?: string) => {
  try {
    return s ? open(s) : undefined;
  } catch {
    return undefined; // a secret that cannot be read is treated as not set
  }
};

export function invalidateIntegrations() {
  cache = null;
}

export async function getIntegrations(): Promise<LiveIntegrations> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const doc = await Integrations.findOne({ key: 'global' }).lean();
  // Credentials are a pair. Never combine an admin key with an unrelated
  // environment secret (including when the saved secret cannot be decrypted).
  const savedRazorpay = !!(doc?.razorpay?.keyId || doc?.razorpay?.keySecretEnc);
  const value: LiveIntegrations = {
    // A value of the wrong shape (e.g. the Google client secret pasted as the ID) is treated as not set:
    // the ID is sent to every visitor's browser, and a wrong one only breaks the login popup.
    googleClientId: wellFormed(doc?.google?.clientId || env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID),
    facebookAppId: wellFormed(doc?.facebook?.appId || env.FACEBOOK_APP_ID, FACEBOOK_APP_ID),
    facebookAppSecret: safeOpen(doc?.facebook?.appSecretEnc) || env.FACEBOOK_APP_SECRET,
    instagramAppId: wellFormed(doc?.instagram?.appId, INSTAGRAM_APP_ID),
    instagramAppSecret: safeOpen(doc?.instagram?.appSecretEnc),
    razorpayKeyId: (savedRazorpay ? doc?.razorpay?.keyId : env.RAZORPAY_KEY_ID)?.trim(),
    razorpayKeySecret: (savedRazorpay ? safeOpen(doc?.razorpay?.keySecretEnc) : env.RAZORPAY_KEY_SECRET)?.trim(),
    razorpayWebhookSecret: safeOpen(doc?.razorpay?.webhookSecretEnc) || env.RAZORPAY_WEBHOOK_SECRET,
    razorpayEnabled: doc?.razorpay?.enabled ?? true,
    googleMapsApiKey: (doc?.maps?.googleApiKey || env.GOOGLE_MAPS_API_KEY)?.trim() || undefined,
    shiprocket: {
      email: doc?.shiprocket?.email || undefined,
      password: safeOpen(doc?.shiprocket?.passwordEnc) || undefined,
      pickupLocation: doc?.shiprocket?.pickupLocation || undefined,
      channelId: doc?.shiprocket?.channelId || undefined,
      enabled: !!doc?.shiprocket?.enabled,
    },
    razorpayx: {
      accountNumber: doc?.razorpayx?.accountNumber || undefined,
      keyId: doc?.razorpayx?.keyId || undefined,
      keySecret: safeOpen(doc?.razorpayx?.keySecretEnc) || undefined,
      enabled: !!doc?.razorpayx?.enabled,
      autoPayout: !!doc?.razorpayx?.autoPayout,
    },
  };
  cache = { at: Date.now(), value };
  return value;
}
