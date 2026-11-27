import { env } from '../config/env';
import { haversineKm } from '../utils/helpers';

/**
 * Distance by ROAD, the way a map app drives it, not a straight line. Delivery time, delivery fees and
 * the rider's pay all go by these kilometres. The roads come from an OSRM routing server (OpenStreetMap);
 * when it cannot answer, the straight line plus a road allowance is used, marked `road: false`, and the
 * real road is asked for again on the next request.
 */
export interface Pt { lat: number; lng: number }
export interface RoadLeg { km: number; road: boolean }

/** Roads are rarely straight: an estimate is the straight line times this. */
export const ROAD_FACTOR = 1.35;
const ROAD_TTL_MS = 12 * 3600_000; // roads do not change by the hour
const NO_ROAD_TTL_MS = 10 * 60_000; // the service answered but found no road to a place
const DOWN_FOR_MS = 20_000; // after a failure, do not wait on the service again for a moment
const MAX_ENTRIES = 20_000;
const TIMEOUT_MS = 3500;

const round2 = (n: number) => Math.round(n * 100) / 100;
const cell = (p: Pt) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`; // ~11 m
const key = (a: Pt, b: Pt) => `${cell(a)}>${cell(b)}`;

const legCache = new Map<string, { leg: RoadLeg; until: number }>();
const routeCache = new Map<string, { value: RoadRoute; until: number }>();
let downUntil = 0;
export const clearRoadCache = () => { legCache.clear(); routeCache.clear(); downUntil = 0; };

function remember<T>(map: Map<string, { until: number } & Record<string, unknown>>, k: string, entry: { until: number } & Record<string, unknown>) {
  if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value as string);
  map.set(k, entry);
  void (null as unknown as T);
}

/** Tests that only care about the rest of the shop set ROAD_DISTANCE_MODE=straight so they never reach the network. */
const straightMode = () => process.env.ROAD_DISTANCE_MODE === 'straight';
const straight = (a: Pt, b: Pt): RoadLeg => ({ km: round2(haversineKm(a.lat, a.lng, b.lat, b.lng)), road: true });

const estimate = (a: Pt, b: Pt): RoadLeg => ({ km: round2(haversineKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR), road: false });
const coord = (p: Pt) => `${p.lng},${p.lat}`;

async function getJson(path: string): Promise<any | null> {
  if (Date.now() < downUntil) return null;
  const fail = () => { downUntil = Date.now() + DOWN_FOR_MS; return null; };
  try {
    const res = await fetch(`${env.OSRM_URL.replace(/\/$/, '')}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'BingoorApp/1.0 (road distance)' } });
    if (!res.ok) return fail();
    const json = await res.json();
    return json?.code === 'Ok' ? json : null;
  } catch {
    return fail();
  }
}

/** Road km from `from` to each place in `tos`, in one request. Never throws. */
export async function roadLegs(from: Pt, tos: Pt[]): Promise<RoadLeg[]> {
  if (straightMode()) return tos.map((t) => straight(from, t));
  const now = Date.now();
  const out: (RoadLeg | undefined)[] = tos.map((t) => {
    const hit = legCache.get(key(from, t));
    return hit && hit.until > now ? hit.leg : undefined;
  });
  const missing = out.map((l, i) => (l ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    const json = await getJson(`/table/v1/driving/${[from, ...missing.map((i) => tos[i])].map(coord).join(';')}?sources=0&annotations=distance`);
    const row: (number | null)[] | undefined = json?.distances?.[0];
    missing.forEach((i, n) => {
      const meters = row?.[n + 1];
      const leg: RoadLeg = typeof meters === 'number' ? { km: round2(meters / 1000), road: true } : estimate(from, tos[i]);
      out[i] = leg;
      // A real road is remembered for hours; an estimate only when the service answered and found no road there.
      if (leg.road || row) remember(legCache as never, key(from, tos[i]), { leg, until: now + (leg.road ? ROAD_TTL_MS : NO_ROAD_TTL_MS) });
    });
  }
  return out as RoadLeg[];
}

/** Road km from one place to another. Never throws. */
export async function roadKm(from: Pt, to: Pt): Promise<number> {
  return (await roadLegs(from, [to]))[0].km;
}

export interface RoadRoute extends RoadLeg {
  /** The road to draw, as [lat, lng] points; null when the real road is not known (never a straight line). */
  points: [number, number][] | null;
}

/** The road distance and the road itself, for drawing on a map. Never throws. */
export async function roadRoute(from: Pt, to: Pt): Promise<RoadRoute> {
  if (straightMode()) return { ...straight(from, to), points: null };
  const now = Date.now();
  const k = key(from, to);
  const hit = routeCache.get(k);
  if (hit && hit.until > now) return hit.value;
  const json = await getJson(`/route/v1/driving/${coord(from)};${coord(to)}?overview=simplified&geometries=geojson`);
  const r = json?.routes?.[0];
  const coords: number[][] | undefined = r?.geometry?.coordinates;
  const value: RoadRoute = typeof r?.distance === 'number' && coords?.length
    ? { km: round2(r.distance / 1000), road: true, points: coords.map(([lng, lat]) => [lat, lng] as [number, number]) }
    : { ...estimate(from, to), points: null };
  if (value.road) remember(routeCache as never, k, { value, until: now + ROAD_TTL_MS } as never);
  return value;
}
