import { Platform } from 'react-native';

/**
 * Backend base URL.
 *
 * - Android emulator  -> http://10.0.2.2:5000/api/v1   (10.0.2.2 = your PC from inside the emulator)
 * - iOS simulator/web -> http://localhost:5000/api/v1
 * - Real phone        -> http://<your-PC-LAN-IP>:5000/api/v1   (set EXPO_PUBLIC_API_URL in .env)
 */
const fallback =
  Platform.OS === 'android' ? 'http://10.0.2.2:5000/api/v1' : 'http://localhost:5000/api/v1';

export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL || fallback).replace(/\/+$/, '');
