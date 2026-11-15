import Geolocation, { GeolocationError, GeolocationResponse } from '@react-native-community/geolocation';
import { useSyncExternalStore } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

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
      // Delivery pins use a recent fix; the customer can adjust it on the map.
      maximumAge: highAccuracy ? 10_000 : 30_000,
    }),
  );

const problemOf = (e: unknown): LocationProblem => {
  const code = (e as GeolocationError | undefined)?.code;
  return code === 1 ? 'denied' : code === 2 ? 'off' : 'timeout';
};

/**
 * Try a recent precise GPS fix first, then the network/Wi-Fi fallback indoors.
 * The map lets the customer confirm or adjust either result before saving.
 * `accuracy` is the radius of uncertainty in metres (bigger = less precise):
 * the precise fix is a few metres, the indoor network fallback can be hundreds,
 * so callers warn the customer to check the pin when it is large.
 */
export async function getPhoneLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  if (!(await askLocationPermission())) throw new Error('denied' satisfies LocationProblem);
  let first: LocationProblem;
  try {
    const pos = await read(true, 15_000);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch (e) {
    first = problemOf(e);
    if (first === 'denied') throw new Error(first);
  }
  try {
    const pos = await read(false, 10_000);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch (e) {
    const second = problemOf(e);
    throw new Error(second === 'timeout' && first === 'off' ? 'off' : second);
  }
}

export const problemFromError = (e: unknown): LocationProblem => {
  const m = (e as Error | undefined)?.message;
  return m === 'denied' || m === 'off' ? m : 'timeout';
};

/**
 * Takes the customer straight to the phone screen where Location can be switched on
 * (an app cannot turn GPS on by itself - the phone only lets the customer do that).
 */
export async function openLocationSettings(problem: LocationProblem): Promise<void> {
  try {
    if (problem === 'off' && Platform.OS === 'android') await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    else await Linking.openSettings();
  } catch {
    await Linking.openSettings().catch(() => undefined);
  }
}

/** One tap to fix it: explains the problem and offers the settings screen. */
export function offerLocationFix(problem: LocationProblem): void {
  if (problem === 'timeout') return;
  Alert.alert(
    problem === 'off' ? 'Turn on location' : 'Allow location',
    locationMessage(problem),
    [
      { text: 'Not now', style: 'cancel' },
      { text: problem === 'off' ? 'Turn on location' : 'Open settings', onPress: () => void openLocationSettings(problem) },
    ],
  );
}

/* The last reason the phone's location could not be read, shared so Home can show a tappable hint. */
let currentProblem: LocationProblem | null = null;
const problemListeners = new Set<() => void>();
export function setLocationProblem(next: LocationProblem | null) {
  if (next === currentProblem) return;
  currentProblem = next;
  problemListeners.forEach((l) => l());
}
export function useLocationProblem(): LocationProblem | null {
  return useSyncExternalStore(
    (l) => { problemListeners.add(l); return () => { problemListeners.delete(l); }; },
    () => currentProblem,
    () => null,
  );
}
