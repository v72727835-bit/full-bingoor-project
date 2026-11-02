import Geolocation, { GeolocationError, GeolocationResponse } from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export type LocationProblem = 'denied' | 'off' | 'timeout';

/** Why the phone's location could not be read, in words a customer can act on. */
export function locationMessage(problem: LocationProblem): string {
  if (problem === 'denied') return 'Location permission is off. Allow it for Bingoor in your phone settings, or paste a pin.';
  if (problem === 'off') return 'Turn on Location (GPS) in your phone and try again.';
  return 'Your phone took too long to find you. Step near a window or outside and try again, or paste a pin.';
}

/** Asks for location permission on Android (iOS asks by itself). */
export async function askLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]).catch(() => null);
  if (!result) return false;
  return (
    result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
    result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
  );
}

const read = (highAccuracy: boolean, timeout: number) =>
  new Promise<GeolocationResponse>((resolve, reject) =>
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout,
      // A fix from the last few minutes is good enough for a delivery pin.
      maximumAge: highAccuracy ? 30_000 : 5 * 60_000,
    }),
  );

const problemOf = (e: unknown): LocationProblem => {
  const code = (e as GeolocationError | undefined)?.code;
  return code === 1 ? 'denied' : code === 2 ? 'off' : 'timeout';
};

/**
 * The phone's position. Indoors a GPS-only fix often never arrives, which is
 * what made "Use my current location" fail: so the quick network/Wi-Fi fix is
 * tried first, then GPS with more time.
 */
export async function getPhoneLocation(): Promise<{ lat: number; lng: number }> {
  if (!(await askLocationPermission())) throw new Error('denied' satisfies LocationProblem);
  let first: LocationProblem;
  try {
    const pos = await read(false, 10_000);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    first = problemOf(e);
    if (first === 'denied') throw new Error(first);
  }
  try {
    const pos = await read(true, 25_000);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    const second = problemOf(e);
    throw new Error(second === 'timeout' && first === 'off' ? 'off' : second);
  }
}

export const problemFromError = (e: unknown): LocationProblem => {
  const m = (e as Error | undefined)?.message;
  return m === 'denied' || m === 'off' ? m : 'timeout';
};
