import crypto from 'crypto';
import { DeviceToken } from '../models/DeviceToken';
import { ApiError } from '../utils/ApiError';
import { getIntegrations } from './integrations.service';

/**
 * Firebase without the admin SDK:
 *  - verifyPhoneToken: checks a Firebase Auth ID token (phone OTP) against Google's public certificates.
 *  - sendPush: FCM HTTP v1, signed in with the service account the super admin saved.
 * Everything is read from the admin panel's settings, so no redeploy is needed to change keys.
 */

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certs: { at: number; exp: number; map: Record<string, string> } | null = null;

async function getCerts(force = false): Promise<Record<string, string>> {
  if (!force && certs && Date.now() < certs.exp) return certs.map;
  const r = await fetch(CERT_URL);
  if (!r.ok) throw new ApiError(503, 'Could not reach Google to check the OTP. Please try again.');
  const map = (await r.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  certs = { at: Date.now(), exp: Date.now() + maxAge * 1000, map };
  return map;
}

const b64 = (s: string) => Buffer.from(s, 'base64url');

/** Returns the verified phone number (e.g. +919876543210) from a Firebase ID token, or throws a 401. */
export async function verifyPhoneToken(idToken: string): Promise<string> {
  const { firebase } = await getIntegrations();
  const projectId = firebase.webConfig.projectId || firebase.serviceAccount?.project_id;
  if (!projectId) throw new ApiError(503, 'Phone OTP is not set up yet.');
  const bad = () => new ApiError(401, 'The OTP could not be verified. Please request a new code.');

  const parts = idToken.split('.');
  if (parts.length !== 3) throw bad();
  let header: { alg?: string; kid?: string };
  let payload: { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number; phone_number?: string };
  try {
    header = JSON.parse(b64(parts[0]).toString());
    payload = JSON.parse(b64(parts[1]).toString());
  } catch {
    throw bad();
  }
  if (header.alg !== 'RS256' || !header.kid) throw bad();

  let map = await getCerts();
  if (!map[header.kid]) map = await getCerts(true);
  const cert = map[header.kid];
  if (!cert) throw bad();

  const valid = crypto.createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(cert, b64(parts[2]));
  const now = Math.floor(Date.now() / 1000);
  if (
    !valid ||
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.sub ||
    !payload.exp ||
    payload.exp < now ||
    (payload.iat ?? 0) > now + 300 ||
    !payload.phone_number
  ) {
    throw bad();
  }
  return payload.phone_number;
}

/** "+919876543210" -> "9876543210" (the form phones are stored in). */
export const localPhone = (e164: string) => e164.replace(/^\+91/, '').replace(/\D/g, '');

/** Requires a valid OTP token for `phone`, or throws. `otp_required` tells the app to show the OTP step. */
export async function requireOtp(kind: 'signup' | 'login', phone: string, idToken?: string): Promise<boolean> {
  const { firebase } = await getIntegrations();
  const on = kind === 'signup' ? firebase.otpOnSignup : firebase.otpOnLogin;
  if (!on) return false;
  if (!idToken) throw new ApiError(428, 'Please verify your phone number with the OTP.', { code: 'otp_required', phone: localPhone(phone) });
  const verified = localPhone(await verifyPhoneToken(idToken));
  if (verified !== localPhone(phone)) throw new ApiError(400, 'The OTP was verified for a different phone number.');
  return true;
}

/* ---------------- Push (FCM HTTP v1) ---------------- */

let access: { token: string; exp: number; email: string } | null = null;

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  if (access && access.email === sa.client_email && Date.now() < access.exp - 60_000) return access.token;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(j.error_description || 'Google rejected the service account');
  access = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, email: sa.client_email };
  return j.access_token;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Extra data for the app to route on, e.g. { orderId, type }. */
  data?: Record<string, string>;
}

/** Sends to one device token. Returns 'ok', 'dead' (token no longer valid: delete it) or 'error'. */
async function sendOne(projectId: string, bearer: string, token: string, m: PushMessage): Promise<'ok' | 'dead' | 'error'> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title, body: m.body },
        data: m.data ?? {},
        android: { priority: 'HIGH', notification: { sound: 'default' } },
        webpush: { fcm_options: { link: m.data?.url ?? '/' } },
      },
    }),
  });
  if (r.ok) return 'ok';
  const j = (await r.json().catch(() => ({}))) as { error?: { status?: string } };
  return j.error?.status === 'NOT_FOUND' || j.error?.status === 'UNREGISTERED' ? 'dead' : 'error';
}

/** Pushes to every device of the given users. Never throws: a failed push must never break an order. */
export async function pushToUsers(userIds: (string | { toString(): string })[], m: PushMessage): Promise<number> {
  try {
    const { firebase } = await getIntegrations();
    const sa = firebase.serviceAccount;
    if (!firebase.pushEnabled || !sa || !userIds.length) return 0;
    const devices = await DeviceToken.find({ user: { $in: userIds.map(String) } }).select('token').lean();
    if (!devices.length) return 0;
    const bearer = await accessToken(sa);
    let sent = 0;
    const dead: string[] = [];
    for (let i = 0; i < devices.length; i += 10) {
      await Promise.all(
        devices.slice(i, i + 10).map(async (d) => {
          const res = await sendOne(sa.project_id, bearer, d.token, m);
          if (res === 'ok') sent++;
          else if (res === 'dead') dead.push(d.token);
        }),
      );
    }
    if (dead.length) await DeviceToken.deleteMany({ token: { $in: dead } });
    return sent;
  } catch (e) {
    console.error('[push] failed:', (e as Error).message);
    return 0;
  }
}

/** For the admin "send test" button: surfaces the real error instead of swallowing it. */
export async function checkServiceAccount(): Promise<string> {
  const { firebase } = await getIntegrations();
  if (!firebase.serviceAccount) throw new ApiError(400, 'Save the Firebase service account JSON first.');
  await accessToken(firebase.serviceAccount).catch((e) => {
    throw new ApiError(400, `Google did not accept this service account: ${(e as Error).message}`);
  });
  return firebase.serviceAccount.project_id;
}
