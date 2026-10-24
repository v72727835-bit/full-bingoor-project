/**
 * Bingoor service worker.
 *
 * The cache strategy differs by request type on purpose:
 *
 *   - Navigations (HTML) are NETWORK-FIRST. An HTML document names the exact
 *     hashed JS/CSS bundles of the build it came from, so serving a cached
 *     document after a new deploy asks the browser for bundles that no longer
 *     exist and the page fails to boot. Cache is only the offline fallback.
 *
 *   - Build output under /_next/static is content-hashed, so a URL's bytes
 *     never change. Those are cache-first.
 *
 *   - Product artwork and icons rarely change and are large-ish, so they are
 *     cache-first with a quiet background refresh.
 *
 * Bump CACHE whenever this file changes; activate() drops every older cache.
 */

const CACHE = 'autozo-v2';
const SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Lets the page force an immediate takeover after an update is found. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const putInCache = (request, response) => {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // The backend API and any other origin is never intercepted.
  if (url.origin !== self.location.origin) return;

  // Never cache Next.js data or server-action traffic.
  if (url.pathname.startsWith('/_next/data') || url.pathname.startsWith('/api')) return;

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  const immutable = url.pathname.startsWith('/_next/static');
  const artwork = url.pathname.startsWith('/cat/') || url.pathname.startsWith('/icons/');

  if (immutable || artwork) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) {
          // Refresh artwork quietly; hashed bundles never need it.
          if (artwork) fetch(req).then((res) => putInCache(req, res)).catch(() => {});
          return hit;
        }
        return fetch(req).then((res) => putInCache(req, res));
      }),
    );
    return;
  }

  // Everything else: straight to the network, cache only as an offline net.
  event.respondWith(
    fetch(req)
      .then((res) => putInCache(req, res))
      .catch(() => caches.match(req)),
  );
});
