import { NativeModules, Platform, Vibration } from 'react-native';

/**
 * The loud bell for a new job (native `BingoorRing`, Android). It loops our bell
 * sound on the alarm stream, so it is loud even on silent. When the app is in
 * the background or closed, the ring push itself plays the same bell through
 * the "ring" notification channel. Falls back to vibration if the native part
 * is missing.
 */
interface NativeRing {
  start: () => void;
  stop: () => void;
  allowBackgroundRinging: () => void;
}
const native: NativeRing | undefined = Platform.OS === 'android' ? (NativeModules.BingoorRing as NativeRing | undefined) : undefined;
const PATTERN = [0, 700, 700];

export const bell = {
  start() {
    if (native) native.start();
    else Vibration.vibrate(PATTERN, true);
  },
  stop() {
    if (native) native.stop();
    else Vibration.cancel();
  },
  allowBackgroundRinging() {
    try { native?.allowBackgroundRinging(); } catch { /* optional */ }
  },
};
