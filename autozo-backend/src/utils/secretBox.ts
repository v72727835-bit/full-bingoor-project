import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Keys saved from the admin panel are stored encrypted, so a database copy alone
 * does not reveal them.
 *
 * The encryption key is derived from a dedicated `ENCRYPTION_SECRET` so that
 * rotating the JWT refresh secret never makes stored payment/login keys
 * undecryptable. When `ENCRYPTION_SECRET` is not set, we fall back to the legacy
 * key (derived from `JWT_REFRESH_SECRET`) so existing deployments keep working
 * with no config change. `open()` tries the current key first and then the
 * legacy key, so secrets sealed before this change still decrypt even after
 * `ENCRYPTION_SECRET` is introduced — no separate migration step is required.
 */
const legacyKey = () => crypto.createHash('sha256').update(`integrations:${env.JWT_REFRESH_SECRET}`).digest();
const currentKey = () =>
  env.ENCRYPTION_SECRET
    ? crypto.createHash('sha256').update(`integrations:${env.ENCRYPTION_SECRET}`).digest()
    : legacyKey();

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', currentKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function open(sealed: string): string {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64'));
  // Build the full list of keys to try: the current key, plus the legacy key
  // when it differs (so secrets sealed with the old derivation still open).
  const keys = [currentKey()];
  if (env.ENCRYPTION_SECRET) keys.push(legacyKey());
  let lastErr: unknown;
  for (const k of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
