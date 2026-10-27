import { Schema, model } from 'mongoose';

/**
 * Sign-in and payment keys the super admin types into the admin panel. Secrets
 * are kept encrypted (`...Enc`) and are never sent back to a browser.
 */
export interface IIntegrations {
  key: 'global';
  google?: { clientId?: string };
  facebook?: { appId?: string; appSecretEnc?: string };
  razorpay?: { keyId?: string; keySecretEnc?: string; webhookSecretEnc?: string; enabled?: boolean };
  /** Google Maps JS API key. Client-side (restricted by referrer), so it is NOT a hidden secret. */
  maps?: { googleApiKey?: string };
  /** Firebase: phone OTP (sign-up / login) and push notifications. */
  firebase?: {
    webConfig?: { apiKey?: string; authDomain?: string; projectId?: string; appId?: string; messagingSenderId?: string; storageBucket?: string; vapidKey?: string };
    serviceAccountEnc?: string;
    otpOnSignup?: boolean;
    otpOnLogin?: boolean;
    pushEnabled?: boolean;
  };
  /** Shiprocket courier: API user email + password, and the pickup location to ship from. */
  shiprocket?: { email?: string; passwordEnc?: string; pickupLocation?: string; channelId?: string; enabled?: boolean };
  /** RazorpayX payouts: pay a rider's withdrawal to their UPI/bank automatically. */
  razorpayx?: { accountNumber?: string; keyId?: string; keySecretEnc?: string; enabled?: boolean; autoPayout?: boolean };
}

const schema = new Schema<IIntegrations>(
  {
    key: { type: String, default: 'global', unique: true },
    google: { clientId: { type: String, trim: true } },
    facebook: { appId: { type: String, trim: true }, appSecretEnc: String },
    razorpay: { keyId: { type: String, trim: true }, keySecretEnc: String, webhookSecretEnc: String, enabled: { type: Boolean, default: true } },
    maps: { googleApiKey: { type: String, trim: true } },
    firebase: {
      webConfig: {
        apiKey: { type: String, trim: true },
        authDomain: { type: String, trim: true },
        projectId: { type: String, trim: true },
        appId: { type: String, trim: true },
        messagingSenderId: { type: String, trim: true },
        storageBucket: { type: String, trim: true },
        vapidKey: { type: String, trim: true },
      },
      serviceAccountEnc: String,
      otpOnSignup: { type: Boolean, default: false },
      otpOnLogin: { type: Boolean, default: false },
      pushEnabled: { type: Boolean, default: false },
    },
    shiprocket: {
      email: { type: String, trim: true },
      passwordEnc: String,
      pickupLocation: { type: String, trim: true },
      channelId: { type: String, trim: true },
      enabled: { type: Boolean, default: false },
    },
    razorpayx: {
      accountNumber: { type: String, trim: true },
      keyId: { type: String, trim: true },
      keySecretEnc: String,
      enabled: { type: Boolean, default: false },
      autoPayout: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export const Integrations = model<IIntegrations>('Integrations', schema);
