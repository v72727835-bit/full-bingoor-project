import { env } from '../config/env';
import { Integrations } from '../models/Integrations';
import { open } from '../utils/secretBox';

/** What the server uses right now: the admin panel's values, falling back to the .env file. */
export interface LiveIntegrations {
  googleClientId?: string;
  facebookAppId?: string;
  facebookAppSecret?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  razorpayEnabled: boolean;
  /** Google Maps JS API key (client-side). Empty when maps should fall back to OpenStreetMap. */
  googleMapsApiKey?: string;
  firebase: {
    webConfig: Record<string, string | undefined>;
    serviceAccount?: { project_id: string; client_email: string; private_key: string };
    otpOnSignup: boolean;
    otpOnLogin: boolean;
    pushEnabled: boolean;
  };
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

function parseServiceAccount(s?: string) {
  const raw = safeOpen(s);
  if (!raw) return undefined;
  try {
    const j = JSON.parse(raw);
    return j.client_email && j.private_key && j.project_id ? { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key } : undefined;
  } catch {
    return undefined;
  }
}

const TTL_MS = 15_000;
let cache: { at: number; value: LiveIntegrations } | null = null;

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
    googleClientId: doc?.google?.clientId || env.GOOGLE_CLIENT_ID,
    facebookAppId: doc?.facebook?.appId || env.FACEBOOK_APP_ID,
    facebookAppSecret: safeOpen(doc?.facebook?.appSecretEnc) || env.FACEBOOK_APP_SECRET,
    razorpayKeyId: (savedRazorpay ? doc?.razorpay?.keyId : env.RAZORPAY_KEY_ID)?.trim(),
    razorpayKeySecret: (savedRazorpay ? safeOpen(doc?.razorpay?.keySecretEnc) : env.RAZORPAY_KEY_SECRET)?.trim(),
    razorpayWebhookSecret: safeOpen(doc?.razorpay?.webhookSecretEnc) || env.RAZORPAY_WEBHOOK_SECRET,
    razorpayEnabled: doc?.razorpay?.enabled ?? true,
    googleMapsApiKey: (doc?.maps?.googleApiKey || env.GOOGLE_MAPS_API_KEY)?.trim() || undefined,
    firebase: {
      webConfig: { ...(doc?.firebase?.webConfig ?? {}) },
      serviceAccount: parseServiceAccount(doc?.firebase?.serviceAccountEnc),
      otpOnSignup: !!doc?.firebase?.otpOnSignup,
      otpOnLogin: !!doc?.firebase?.otpOnLogin,
      pushEnabled: !!doc?.firebase?.pushEnabled,
    },
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
