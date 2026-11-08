import { Vibration } from 'react-native';

/**
 * A short buzz on the taps that matter.
 *
 * Vibration rather than a haptics library: the app already depends on enough
 * native modules, and all this needs is a few milliseconds of motor. Every
 * call is wrapped because an emulator or a phone with the motor disabled
 * throws, and a missing buzz must never take a screen down with it.
 */
function buzz(ms: number) {
  try {
    Vibration.vibrate(ms);
  } catch {
    /* no motor on this device */
  }
}

/** Switching tabs. Phones ignore pulses much under ~30 ms, so this is long enough to be felt. */
export const tapTab = () => buzz(40);

/** Confirming something the customer chose, e.g. the delivery time. */
export const tapConfirm = () => buzz(50);

/** Dropping an item into the cart - a short, Blinkit-style buzz on every ADD. */
export const tapAdd = () => buzz(45);
