import { api } from '../api/client';

/**
 * Picks the Leaflet base layer for admin maps: Google tiles (via GoogleMutant)
 * when a Google Maps API key is configured under Login & Payments → Google Maps,
 * otherwise OpenStreetMap. Falls back to OpenStreetMap if Google fails to load,
 * so a map is never left blank.
 */
type LeafletNS = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;

let cfgPromise: Promise<{ provider?: string; googleMapsApiKey?: string | null } | null> | null = null;

function mapsConfig() {
  if (!cfgPromise) {
    cfgPromise = api
      .get('/settings/public')
      .then((r) => r.data?.data?.maps ?? null)
      .catch(() => null);
  }
  return cfgPromise;
}

let googleLoader: Promise<boolean> | null = null;
function loadGoogleMaps(key: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const w = window as unknown as { google?: { maps?: unknown } };
  if (w.google?.maps) return Promise.resolve(true);
  if (googleLoader) return googleLoader;
  googleLoader = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=quarterly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return googleLoader;
}

function osm(L: LeafletNS, map: LeafletMap) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
}

export async function addBaseLayer(L: LeafletNS, map: LeafletMap): Promise<void> {
  const cfg = await mapsConfig();
  const key = cfg?.provider === 'google' ? cfg?.googleMapsApiKey : null;
  if (!key) {
    osm(L, map);
    return;
  }
  try {
    if (!(await loadGoogleMaps(key))) {
      osm(L, map);
      return;
    }
    await import('leaflet.gridlayer.googlemutant');
    const gridLayer = (L as unknown as { gridLayer: { googleMutant?: (o: unknown) => { addTo: (m: LeafletMap) => void } } }).gridLayer;
    if (gridLayer.googleMutant) gridLayer.googleMutant({ type: 'roadmap' }).addTo(map);
    else osm(L, map);
  } catch {
    osm(L, map);
  }
}
