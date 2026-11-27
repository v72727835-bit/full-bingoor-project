import { env } from '../config/env';
import { haversineKm } from '../utils/helpers';

/**
 * Distance by the SHORTEST ROAD route, the way a map app lists its alternatives, not a straight line and not
 * merely the quickest road. Delivery time, delivery fees, the rider's pay and the route the rider is sent on
 * all go by this one route, so every screen shows the same kilometres.
 *
 * Roads come from Google Directions when a server key is set (GOOGLE_DIRECTIONS_API_KEY), otherwise from an
 * OSRM routing server (OpenStreetMap). Each is asked for its alternative routes and the shortest by distance is
 * used. When nothing can answer, the straight line plus a road allowance is used, marked `road: false`, and the
 * real road is asked for again on the next request.
 */
export interface Pt { lat: number; lng: number }
export interface RoadLeg { km: number; road: boolean }

/** Roads are rarely straight: an estimate is the straight line times this. */
export const ROAD_FACTOR = 1.35;
const ROAD_TTL_MS = 12 * 3600_000; // roads do not change by the hour
const NO_ROAD_TTL_MS = 10 * 60_000; // the service answered but found no road to a place
const DOWN_FOR_MS = 20_000; // after a failure, do not wait on the service again for a moment
const GOOGLE_DENIED_FOR_MS = 3600_000; // a refused key is not retried for an hour
const MAX_ENTRIES = 20_000;
const TIMEOUT_MS = 3500;

const round2 = (n: number) => Math.round(n * 100) / 100;
const cell = (p: Pt) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`; // ~11 m
const key = (a: Pt, b: Pt) => `${cell(a)}>${cell(b)}`;

export interface RoadRoute extends RoadLeg {
  /** The road to draw, as [lat, lng] points; null when the real road is not known (never a straight line). */
  points: [number, number][] | null;
}

const routeCache = new Map<string, { value: RoadRoute; until: number }>();
let downUntil = 0;
let googleDownUntil = 0;
export const clearRoadCache = () => { routeCache.clear(); downUntil = 0; googleDownUntil = 0; };

function remember(k: string, value: RoadRoute, ttl: number) {
  if (routeCache.size >= MAX_ENTRIES) routeCache.delete(routeCache.keys().next().value as string);
  routeCache.set(k, { value, until: Date.now() + ttl });
}

/** Tests that only care about the rest of the shop set ROAD_DISTANCE_MODE=straight so they never reach the network. */
const straightMode = () => process.env.ROAD_DISTANCE_MODE === 'straight';
const straight = (a: Pt, b: Pt): RoadLeg => ({ km: round2(haversineKm(a.lat, a.lng, b.lat, b.lng)), road: true });
const estimate = (a: Pt, b: Pt): RoadLeg => ({ km: round2(haversineKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR), road: false });
const coord = (p: Pt) => `${p.lng},${p.lat}`;

/** Google's encoded polyline -> [lat, lng] points. */
export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** A few points along a road (not its ends), so a map app that is given them as stops follows this same road. */
export function waypointsAlong(points: [number, number][], count: number): Pt[] {
  if (points.length < 3 || count < 1) return [];
  const out: Pt[] = [];
  for (let n = 1; n <= count; n++) {
    const p = points[Math.round((n * (points.length - 1)) / (count + 1))];
    out.push({ lat: Math.round(p[0] * 1e5) / 1e5, lng: Math.round(p[1] * 1e5) / 1e5 });
  }
  return out;
}

/** Google Directions with alternatives: the shortest by distance. Null when it cannot answer. */
async function googleShortest(from: Pt, to: Pt): Promise<{ km: number; points: [number, number][] } | null> {
  const apiKey = process.env.GOOGLE_DIRECTIONS_API_KEY;
  if (!apiKey || Date.now() < googleDownUntil) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&mode=driving&alternatives=true&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = res.ok ? await res.json() : null;
    if (json?.status === 'OK' && Array.isArray(json.routes) && json.routes.length) {
      const best = [...json.routes].sort((a: any, b: any) => (a.legs?.[0]?.distance?.value ?? Infinity) - (b.legs?.[0]?.distance?.value ?? Infinity))[0];
      const meters = best?.legs?.[0]?.distance?.value;
      if (typeof meters === 'number') return { km: round2(meters / 1000), points: best.overview_polyline?.points ? decodePolyline(best.overview_polyline.points) : [] };
    }
    // A refused key (restricted to websites, API off, billing) is not retried for a while.
    if (json?.status === 'REQUEST_DENIED' || json?.status === 'OVER_QUERY_LIMIT') googleDownUntil = Date.now() + GOOGLE_DENIED_FOR_MS;
    return null;
  } catch {
    return null;
  }
}

/** OSRM with alternatives: the shortest by distance. `undefined` = the service did not answer; `null` = no road there. */
async function osrmShortest(from: Pt, to: Pt): Promise<{ km: number; points: [number, number][] } | null | undefined> {
  if (Date.now() < downUntil) return undefined;
  const fail = () => { downUntil = Date.now() + DOWN_FOR_MS; return undefined; };
  try {
    const res = await fetch(`${env.OSRM_URL.replace(/\/$/, '')}/route/v1/driving/${coord(from)};${coord(to)}?alternatives=3&overview=simplified&geometries=geojson`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'BingoorApp/1.0 (road distance)' } });
    if (!res.ok) return fail();
    const json = await res.json();
    if (json?.code !== 'Ok' || !Array.isArray(json.routes) || !json.routes.length) return null;
    const best = [...json.routes].sort((a: any, b: any) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0];
    if (typeof best?.distance !== 'number') return null;
    return { km: round2(best.distance / 1000), points: (best.geometry?.coordinates ?? []).map(([lng, lat]: number[]) => [lat, lng] as [number, number]) };
  } catch {
    return fail();
  }
}

/** The shortest road from one place to another, with the road itself. Never throws. */
export async function roadRoute(from: Pt, to: Pt): Promise<RoadRoute> {
  if (straightMode()) return { ...straight(from, to), points: null };
  const k = key(from, to);
  const hit = routeCache.get(k);
  if (hit && hit.until > Date.now()) return hit.value;
  const found = (await googleShortest(from, to)) ?? (await osrmShortest(from, to));
  if (found) {
    const value: RoadRoute = { km: found.km, road: true, points: found.points.length > 1 ? found.points : null };
    remember(k, value, ROAD_TTL_MS);
    return value;
  }
  const value: RoadRoute = { ...estimate(from, to), points: null };
  // Only when the service answered "no road there" is the estimate remembered; a service that is down is retried.
  if (found === null) remember(k, value, NO_ROAD_TTL_MS);
  return value;
}

/** Shortest-road km from `from` to each place in `tos`. Never throws. */
export async function roadLegs(from: Pt, tos: Pt[]): Promise<RoadLeg[]> {
  if (straightMode()) return tos.map((t) => straight(from, t));
  return Promise.all(tos.map(async (t) => { const r = await roadRoute(from, t); return { km: r.km, road: r.road }; }));
}

/** Shortest-road km from one place to another. Never throws. */
export async function roadKm(from: Pt, to: Pt): Promise<number> {
  return (await roadLegs(from, [to]))[0].km;
}
