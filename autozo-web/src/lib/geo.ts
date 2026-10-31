/**
 * Point 16: the customer's exact position and its address.
 *
 * Position: a single getCurrentPosition() often hands back a cached or Wi-Fi /
 * mobile-tower fix that is hundreds of metres off. Instead the GPS is watched
 * for a few seconds (no cached fixes) and the most accurate reading wins; it
 * stops early once a reading is within ~25 m.
 *
 * Address: when the admin has saved a Google Maps key (Login & Payments), the
 * pin is turned into an address by Google, whose Indian street and locality
 * data is far better than OpenStreetMap's; without a key, or if Google refuses
 * (Geocoding API not enabled on the key), the free OpenStreetMap lookup is used.
 */
import { matchState } from './india';
import { MapsConfig, loadGoogleMaps } from './mapBase';

export interface Fix {
  lat: number;
  lng: number;
  /** Metres. */
  accuracy: number;
}

export interface PlaceParts {
  city?: string;
  state?: string;
  pincode?: string;
  line?: string;
  line1?: string;
  area?: string;
}

export interface PlaceHit {
  display_name: string;
  lat: string;
  lon: string;
}

let maps: MapsConfig | null = null;
/** Called by SettingsProvider once the public settings arrive. */
export function setGeoMaps(cfg: MapsConfig | null | undefined) {
  maps = cfg ?? null;
}
const googleKey = () => (maps?.provider === 'google' && maps.googleMapsApiKey) || null;

/**
 * The most accurate position the device gives within `maxWaitMs`. Resolves as
 * soon as a reading is within `goodEnoughM`; rejects with the browser's
 * GeolocationPositionError when no reading comes at all.
 */
export function accuratePosition({ goodEnoughM = 25, maxWaitMs = 12000, onFix }: { goodEnoughM?: number; maxWaitMs?: number; onFix?: (fix: Fix) => void } = {}): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 2, message: 'Geolocation is not available' });
      return;
    }
    let best: Fix | null = null;
    let done = false;
    const finish = (err?: GeolocationPositionError) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(err ?? { code: 3, message: 'Timed out' });
    };
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) {
          best = fix;
          onFix?.(fix);
        }
        if (fix.accuracy <= goodEnoughM) finish();
      },
      (err) => {
        // Permission refused ends it at once; a slow GPS keeps waiting for the timer.
        if (err.code === 1 || best) finish(err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
    );
    const timer = setTimeout(() => finish(), maxWaitMs);
  });
}

/* ------------------------------ Google lookups ----------------------------- */

interface GComponent {
  long_name: string;
  types: string[];
}
interface GResult {
  formatted_address: string;
  address_components: GComponent[];
  geometry: { location: { lat: () => number; lng: () => number } };
}
type Geocoder = { geocode: (req: Record<string, unknown>) => Promise<{ results: GResult[] }> };

async function geocoder(): Promise<Geocoder | null> {
  const key = googleKey();
  if (!key || !(await loadGoogleMaps(key))) return null;
  const g = (window as unknown as { google?: { maps?: { Geocoder?: new () => Geocoder } } }).google;
  return g?.maps?.Geocoder ? new g.maps.Geocoder() : null;
}

function fromGoogle(r: GResult): PlaceParts {
  const get = (...types: string[]) => r.address_components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;
  const line1 = [get('premise', 'subpremise', 'street_number'), get('route')].filter(Boolean).join(', ');
  const state = get('administrative_area_level_1');
  return {
    city: get('locality', 'administrative_area_level_3', 'administrative_area_level_2'),
    state: matchState(state) || state,
    pincode: get('postal_code')?.replace(/\D/g, '').slice(0, 6),
    line: r.formatted_address,
    line1: line1 || undefined,
    area: get('sublocality_level_1', 'sublocality', 'neighborhood', 'sublocality_level_2'),
  };
}

/* ------------------------------ public lookups ----------------------------- */

/** City, state, PIN and street for a pin. Failure just returns nothing. */
export async function reverseGeocode(lat: number, lng: number): Promise<PlaceParts> {
  try {
    const gc = await geocoder();
    if (gc) {
      const { results } = await gc.geocode({ location: { lat, lng } });
      // The most specific result (a street address / building) comes first.
      if (results?.length) {
        const parts = fromGoogle(results[0]);
        // A PIN or city missing on the first result is usually on the next ones.
        for (const r of results.slice(1)) {
          const more = fromGoogle(r);
          parts.pincode ||= more.pincode;
          parts.city ||= more.city;
          parts.area ||= more.area;
          parts.state ||= more.state;
        }
        return parts;
      }
    }
  } catch {
    /* key without the Geocoding API, quota, network - fall back below */
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'en' },
    });
    const j = (await r.json()) as { address?: Record<string, string>; display_name?: string };
    const a = j.address ?? {};
    const street = a.road || a.pedestrian || a.footway || a.residential || '';
    const line1 = [a.house_number, street].filter(Boolean).join(', ');
    return {
      city: a.city || a.town || a.village || a.municipality || a.county || a.state_district,
      state: matchState(a.state) || a.state,
      pincode: a.postcode?.replace(/\D/g, '').slice(0, 6),
      line: j.display_name,
      line1: line1 || a.amenity || a.building || undefined,
      area: a.suburb || a.neighbourhood || a.city_district || a.hamlet || undefined,
    };
  } catch {
    return {};
  }
}

/** Places matching a PIN code, landmark or street, in India. */
export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  try {
    const gc = await geocoder();
    if (gc) {
      const { results } = await gc.geocode({ address: q, componentRestrictions: { country: 'IN' } });
      if (results?.length)
        return results.slice(0, 5).map((r) => ({
          display_name: r.formatted_address,
          lat: String(r.geometry.location.lat()),
          lon: String(r.geometry.location.lng()),
        }));
    }
  } catch {
    /* fall back below */
  }
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`);
  return (await r.json()) as PlaceHit[];
}

/** Straight-line distance in metres between two points. */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "Tonk Road, Sanganer, Jaipur": the street-level name shown in the header and on the address card. */
export function shortPlace(p: PlaceParts): string {
  return [p.line1 || p.area, p.line1 ? p.area : undefined, p.city].filter(Boolean).join(', ');
}

/**
 * Point 16 / Blinkit-style: the customer's exact spot right now plus its
 * address, in one call. `onFix` is told about the first reading straight away
 * so the screen can move before the GPS settles on the most accurate one.
 */
export async function detectHere(onFix?: (fix: Fix) => void): Promise<Fix & { place: PlaceParts }> {
  const fix = await accuratePosition({ onFix });
  const place = await reverseGeocode(fix.lat, fix.lng);
  return { ...fix, place };
}
