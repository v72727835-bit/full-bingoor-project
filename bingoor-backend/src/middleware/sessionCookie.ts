import { RequestHandler } from 'express';
import { env } from '../config/env';

/**
 * Browser panels (the admin / warehouse panel) opt in with `X-Session-Cookie: 1`.
 * For them the long-lived refresh token never reaches JavaScript: it is moved out
 * of every API answer into an HttpOnly cookie, and read back from that cookie when
 * the panel refreshes or logs out. A script injected into the page (XSS) can then
 * no longer steal a session that lasts 30 days. Apps and the website, which do not
 * send the header, keep working exactly as before.
 */
export const REFRESH_COOKIE = 'bingoor_rt';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export const sessionCookie: RequestHandler = (req, res, next) => {
  if (req.get('x-session-cookie') !== '1') return next();

  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1',
  };

  // Refresh / logout: take the token from the cookie when the body has none.
  const fromCookie = readCookie(req.headers.cookie, REFRESH_COOKIE);
  const body = (req.body ?? {}) as { refreshToken?: unknown };
  if (fromCookie && req.method === 'POST' && /\/auth\/(refresh|logout)$/.test(req.path) && typeof body.refreshToken !== 'string') {
    req.body = { ...body, refreshToken: fromCookie };
  }
  if (req.method === 'POST' && /\/auth\/logout$/.test(req.path)) res.clearCookie(REFRESH_COOKIE, cookieOptions);

  const json = res.json.bind(res);
  res.json = (payload?: unknown) => {
    const data = (payload as { data?: { refreshToken?: unknown } } | undefined)?.data;
    if (data && typeof data === 'object' && typeof data.refreshToken === 'string') {
      res.cookie(REFRESH_COOKIE, data.refreshToken, { ...cookieOptions, maxAge: MAX_AGE_MS });
      const { refreshToken: _hidden, ...rest } = data;
      return json({ ...(payload as object), data: rest });
    }
    return json(payload);
  };
  next();
};
