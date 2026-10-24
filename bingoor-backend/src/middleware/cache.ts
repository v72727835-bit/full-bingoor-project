import { RequestHandler, Response } from 'express';
import { clearSettingsCache } from '../services/settings.service';

/**
 * Short-lived cache for the public catalogue.
 *
 * Every customer opening the app asks for the same home feed, category
 * tree and product lists. Rebuilding them from MongoDB on every request is
 * the main cost under load, so successful responses are kept in memory for
 * a few seconds and browsers/CDNs are told they may reuse them too.
 *
 * Stock is still checked atomically when an order is placed, so a product
 * card that is a few seconds stale can never oversell. Any admin write
 * clears the cache so catalogue edits show up immediately.
 */
const TTL_MS = 30_000;
const MAX_ENTRIES = 1_000;
const MAX_BYTES = 32 * 1024 * 1024;
let bytes = 0;
let generation = 0;

type Entry = { expires: number; status: number; body: unknown; bytes: number };
const store = new Map<string, Entry>();
const pending = new Map<string, Set<Response>>();

export function clearCatalogCache(): void {
  store.clear();
  bytes = 0;
  generation++;
  clearSettingsCache();
}

export const catalogCache: RequestHandler = (req, res, next) => {
  // Catalogue responses never depend on who is asking, so signed-in users share the cache.
  if (req.method !== 'GET') return next();

  res.set('Cache-Control', 'no-store');

  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    res.set('Cache-Control', `public, max-age=${TTL_MS / 1000}, stale-while-revalidate=300`);
    res.set('X-Cache', 'HIT');
    res.status(hit.status).json(hit.body);
    return;
  }
  if (hit) { bytes -= hit.bytes; store.delete(key); }

  // Requests for the same cold key share one database read instead of
  // exhausting the connection pool during bursts or Passenger restarts.
  const waiting = pending.get(key);
  if (waiting) {
    if (waiting.size >= 64) {
      res.set('Retry-After', '2').status(503).json({ success: false, message: 'The store is busy. Please try again shortly.' });
      return;
    }
    waiting.add(res);
    res.on('close', () => waiting.delete(res));
    return;
  }
  if (pending.size >= MAX_ENTRIES) {
    res.set('Retry-After', '2').status(503).json({ success: false, message: 'The store is busy. Please try again shortly.' });
    return;
  }
  const followers = new Set<Response>();
  pending.set(key, followers);
  const version = generation;
  const release = (status: number, body: unknown, cached: boolean) => {
    if (pending.get(key) !== followers) return;
    pending.delete(key);
    clearTimeout(timer);
    for (const follower of followers) {
      if (follower.destroyed || follower.writableEnded) continue;
      follower.set('Cache-Control', cached ? `public, max-age=${TTL_MS / 1000}, stale-while-revalidate=300` : 'no-store');
      follower.set('X-Cache', 'COALESCED').status(status).json(body);
    }
    followers.clear();
  };
  const unavailable = () => release(503, { success: false, message: 'The store is taking longer to respond. Please try again shortly.' }, false);
  const timer = setTimeout(unavailable, 20_000);
  timer.unref();
  res.on('close', unavailable);

  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    const cacheable = res.statusCode === 200 && generation === version && pending.get(key) === followers;
    if (cacheable) {
      res.set('Cache-Control', `public, max-age=${TTL_MS / 1000}, stale-while-revalidate=300`);
      // Map keeps insertion order, so the first key is the oldest.
      const size = Buffer.byteLength(JSON.stringify(body) ?? '');
      while (store.size && (store.size >= MAX_ENTRIES || bytes + size > MAX_BYTES)) {
        const oldest = store.keys().next().value as string;
        bytes -= store.get(oldest)!.bytes;
        store.delete(oldest);
      }
      if (size <= MAX_BYTES) {
        store.set(key, { expires: Date.now() + TTL_MS, status: 200, body, bytes: size });
        bytes += size;
      }
    }
    res.set('X-Cache', 'MISS');
    release(res.statusCode, body, cacheable);
    return json(body);
  };
  next();
};

/** Drops cached catalogue pages after any admin change. */
export const invalidateOnWrite: RequestHandler = (req, res, next) => {
  if (req.method !== 'GET') res.on('finish', () => res.statusCode < 400 && clearCatalogCache());
  next();
};
