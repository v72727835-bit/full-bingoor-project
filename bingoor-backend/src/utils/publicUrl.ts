import type { Request } from 'express';

/** Hosts that are only ever reached over plain http (a laptop, the Android emulator, the LAN). */
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0)(:\d+)?$/i;

/**
 * The origin to put in links we hand out (uploaded files, invoices).
 * The live proxy does not always forward X-Forwarded-Proto, which saved
 * images as http://api.bingoor.com/... - and Android apps refuse to load
 * plain-http images. A public host is therefore always https.
 */
export function publicOrigin(req: Request): string {
  const host = req.get('host') ?? '';
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = LOCAL_HOST.test(host) ? forwarded || req.protocol : 'https';
  return `${proto}://${host}`;
}

/** http://(anything.)bingoor.com links in stored data, e.g. images uploaded before the fix above. */
const HTTP_BINGOOR = /http:\/\/((?:[a-z0-9-]+\.)*bingoor\.com)(?=[/"?#:]|$)/gi;

/** Rewrites our own http links to https inside any JSON-able value. */
export function upgradeOwnLinks<T>(body: T): T {
  if (body === undefined || body === null) return body;
  const text = JSON.stringify(body);
  if (!text || !text.includes('http://')) return body;
  HTTP_BINGOOR.lastIndex = 0;
  if (!HTTP_BINGOOR.test(text)) return body;
  return JSON.parse(text.replace(HTTP_BINGOOR, 'https://$1')) as T;
}
