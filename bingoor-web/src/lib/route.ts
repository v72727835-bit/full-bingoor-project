export type LatLng = { lat: number; lng: number };

/** Straight-line distance in km. */
export function kmBetween(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export interface RoadRoute {
  /** Points along the road, [lat, lng]. */
  path: [number, number][];
  km: number;
  minutes: number;
}

/**
 * The road route between two points from the public OSRM server. It is a nicety,
 * not a dependency: on any failure the caller falls back to a straight line and
 * an estimate from the distance.
 */
export async function roadRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RoadRoute | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
    const r = data.routes?.[0];
    if (!r) return null;
    return { path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: r.distance / 1000, minutes: Math.max(1, Math.round(r.duration / 60)) };
  } catch {
    return null;
  }
}

/** A scooter in town averages about 20 km/h, plus a minute to find the door. */
export const roughMinutes = (km: number): number => Math.max(1, Math.round((km / 20) * 60) + 1);
