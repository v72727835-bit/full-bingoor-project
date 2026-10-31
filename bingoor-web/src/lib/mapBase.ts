/**
 * Chooses the Leaflet base layer for every map on the website.
 *
 * When the admin has set a Google Maps API key (Login & Payments → Google Maps),
 * maps render with Google tiles via the GoogleMutant layer; otherwise they use
 * the free OpenStreetMap tiles. All marker / drag / click / routing code stays
 * the same &ndash; only the base layer changes. If Google fails to load for any
 * reason, we fall back to OpenStreetMap so a map is never left blank.
 */
type LeafletNS = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;

export interface MapsConfig {
  provider?: 'google' | 'osm';
  googleMapsApiKey?: string | null;
}

/**
 * One Google Maps script per page. The promise lives on `window`, not in this
 * module, because the map and the address lookup can end up in separate code
 * chunks with their own copy of the module - which loaded the script twice.
 */
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
    script.onload = () => resolve(true);
    script.onerror = () => {
      w.__bingoorGmaps = undefined;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return w.__bingoorGmaps;
}

function osm(L: LeafletNS, map: LeafletMap) {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
}

/** Adds the Google (when a key is configured) or OpenStreetMap base layer to `map`. */
export async function addBaseLayer(L: LeafletNS, map: LeafletMap, cfg?: MapsConfig | null): Promise<void> {
  const key = cfg?.provider === 'google' ? cfg?.googleMapsApiKey : null;
  if (!key) {
    osm(L, map);
    return;
  }
  try {
    const ok = await loadGoogleMaps(key);
    if (!ok) {
      osm(L, map);
      return;
    }
    // GoogleMutant renders Google tiles inside the existing Leaflet map.
    await import('leaflet.gridlayer.googlemutant');
    const gridLayer = (L as unknown as { gridLayer: { googleMutant?: (o: unknown) => { addTo: (m: LeafletMap) => void } } }).gridLayer;
    if (gridLayer.googleMutant) {
      gridLayer.googleMutant({ type: 'roadmap' }).addTo(map);
    } else {
      osm(L, map);
    }
  } catch {
    osm(L, map);
  }
}
