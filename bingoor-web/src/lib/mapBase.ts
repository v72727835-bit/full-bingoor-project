import { API_URL } from './config';

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

export interface MapsConfig { provider?: 'google'; googleMapsApiKey?: string | null }
export function loadGoogleMaps(key: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const w = window as unknown as { google?: { maps?: unknown }; __bingoorGmaps?: Promise<boolean> };
  if (w.google?.maps) return Promise.resolve(true);
  if (w.__bingoorGmaps) return w.__bingoorGmaps;
  w.__bingoorGmaps = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=quarterly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(!!w.google?.maps);
    script.onerror = () => {
      w.__bingoorGmaps = undefined;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return w.__bingoorGmaps;
}

/** Google tiles only. A missing key or provider error never switches map services. */
export async function addBaseLayer(L: LeafletNS, map: LeafletMap, cfg?: MapsConfig | null): Promise<void> {
  try {
    const config = cfg?.googleMapsApiKey ? cfg : (await (await fetch(`${API_URL}/settings/public`)).json()).data?.maps;
    const key = config?.googleMapsApiKey;
    if (!key || !(await loadGoogleMaps(key))) throw new Error('Google Maps is unavailable');
    await import('leaflet.gridlayer.googlemutant');
    const grid = (L as unknown as { gridLayer: { googleMutant?: (options: unknown) => { addTo: (map: LeafletMap) => void } } }).gridLayer;
    if (!grid.googleMutant) throw new Error('Google Maps layer is unavailable');
    grid.googleMutant({ type: 'roadmap' }).addTo(map);
  } catch { mapError(map); }
}
