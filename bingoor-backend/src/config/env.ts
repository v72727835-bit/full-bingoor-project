import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),
  /**
   * Comma-separated front-end origins allowed to call the API from a browser.
   * Unset: development allows any origin; production allows only the Bingoor
   * domains below. "*" allows every origin (not recommended in production).
   */
  CORS_ORIGINS: z.string().optional(),
  /**
   * Optional: dedicated key for encrypting admin-saved integration secrets.
   * When set, rotating JWT_REFRESH_SECRET no longer breaks stored payment/login
   * keys. Falls back to the JWT refresh secret when unset (see utils/secretBox).
   */
  ENCRYPTION_SECRET: z.string().min(16, 'ENCRYPTION_SECRET must be at least 16 chars').optional(),
  /** Optional: WhatsApp order alerts (Meta Cloud API). Both switch the feature on. */
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  /** Optional: online payments switch on when both are set. */
  /** Optional: Continue with Google / Facebook switch on when these are set. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  /** Optional: Continue with Instagram (Instagram API with Instagram Login) app id / secret. */
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  /** Optional: Razorpay webhook signing secret (admin panel value takes precedence). */
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  /** Optional: Google Maps JS API key fallback (admin panel value takes precedence). */
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  FREE_DELIVERY_ABOVE: z.coerce.number().min(0).default(499),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
