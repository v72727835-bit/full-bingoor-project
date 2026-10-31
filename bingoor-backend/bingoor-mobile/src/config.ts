import { Platform } from 'react-native';

/**
 * Set this ONLY when you test on a real phone over Wi-Fi, e.g.
 *   const API_URL_OVERRIDE = 'http://192.168.1.5:5000/api/v1';
 * (phone and PC on the same Wi-Fi, PC IP from `ipconfig`).
 *
 * Leave it null for:
 *  - Android emulator                -> uses http://10.0.2.2:5000/api/v1 (10.0.2.2 = your PC)
 *  - Real phone connected by USB     -> run `adb reverse tcp:5000 tcp:5000` once, then set
 *                                        API_URL_OVERRIDE = 'http://localhost:5000/api/v1'
 *  - iOS simulator                   -> http://localhost:5000/api/v1
 *
 * For a production build, point this to your https:// server.
 */
const API_URL_OVERRIDE: string | null = 'https://api.bingoor.com/api/v1';

const defaultUrl =
  Platform.OS === 'android' ? 'http://10.0.2.2:5000/api/v1' : 'http://localhost:5000/api/v1';

export const API_URL: string = (API_URL_OVERRIDE ?? defaultUrl).replace(/\/+$/, '');
