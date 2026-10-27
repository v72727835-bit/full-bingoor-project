import { api } from './client';

/** The Google Maps API key the admin set (null → maps use OpenStreetMap). Fetched once and cached. */
let cached: Promise<string | null> | null = null;

export function fetchMapsKey(): Promise<string | null> {
  if (!cached) {
    cached = api
      .get('/settings/public')
      .then((r) => {
        const maps = (r.data?.data?.maps ?? null) as { provider?: string; googleMapsApiKey?: string | null } | null;
        return maps?.provider === 'google' ? maps.googleMapsApiKey ?? null : null;
      })
      .catch(() => null);
  }
  return cached;
}
