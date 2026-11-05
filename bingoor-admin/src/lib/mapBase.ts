import { api } from '../api/client';

type LeafletNS = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;

function mapError(map: LeafletMap) {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:absolute;inset:0;z-index:1100;background:var(--surface,#fff);display:grid;place-content:center;text-align:center;padding:20px;gap:12px';
  const text = document.createElement('p');
  text.textContent = 'Google Maps could not load. Check your connection and the Google Maps configuration.';
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = 'Retry Google Maps'; retry.onclick = () => window.location.reload();
  box.append(text, retry); map.getContainer().append(box);
}
let cfgPromise: Promise<{ provider?: string; googleMapsApiKey?: string | null } | null> | null = null;

export function mapsConfig() {
  if (!cfgPromise) {
    cfgPromise = api
      .get('/settings/public')
      .then((r) => r.data?.data?.maps ?? null)
      .catch(() => null);
  }
  return cfgPromise;
}

let googleLoader: Promise<boolean> | null = null;
export function loadGoogleMaps(key: string): Promise<boolean> {
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

export async function addBaseLayer(L: LeafletNS, map: LeafletMap): Promise<void> {
  try {
    const cfg = await mapsConfig();
    const key = cfg?.googleMapsApiKey;
    if (!key || !(await loadGoogleMaps(key))) throw new Error('Google Maps is unavailable');
    await import('leaflet.gridlayer.googlemutant');
    const grid = (L as unknown as { gridLayer: { googleMutant?: (options: unknown) => { addTo: (map: LeafletMap) => void } } }).gridLayer;
    if (!grid.googleMutant) throw new Error('Google Maps layer is unavailable');
    grid.googleMutant({ type: 'roadmap' }).addTo(map);
  } catch { mapError(map); }
}
