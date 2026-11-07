import { DEFAULT_PAYMENT_OPTIONS, ISettings, PayOption, PaymentOptionSetting } from '../models/Settings';
import { round2 } from '../utils/helpers';

export type Slot = 'instant' | 'twoHour' | 'nextDay';

export interface Quote {
  distanceKm: number | null;
  /** Items minus nothing: the amount the free-delivery and minimum rules look at. */
  subtotal: number;
  minOrder: number;
  meetsMinOrder: boolean;
  handlingFee: number;
  /** The charge for the slot or distance, before any waiver. */
  baseDeliveryFee: number;
  /** What is actually charged: 0 once the free-delivery amount is reached. */
  deliveryFee: number;
  freeAbove: number;
  /** "Add Rs X more for free delivery" - 0 when already free. */
  addForFree: number;
  twoHourFee: number;
  /** Delivery days (0 = same day). */
  days: number;
  redOrder: boolean;
  /** Beyond the last band: routed to the special long-distance rider. */
  longDistance: boolean;
  codAllowed: boolean;
  codMessage?: string;
  total: number;
}

type Pricing = ISettings['pricing'];

const DEFAULTS: Pricing = {
  handlingFee: 2,
  bands: [
    { upToKm: 9, minOrder: 199, freeAbove: 199, fee: 39, nextDay: false, redOrder: false },
    { upToKm: 15, minOrder: 199, freeAbove: 999, fee: 39, nextDay: false, redOrder: true },
    { upToKm: 25, minOrder: 199, freeAbove: 699, fee: 39, nextDay: true, redOrder: false },
    { upToKm: 30, minOrder: 199, freeAbove: 1199, fee: 39, nextDay: true, redOrder: false },
  ],
  beyondDays: 3,
  beyondMinOrder: 199,
  beyondCodDisabled: true,
  beyondCodMessage: 'For long distance "COD" option is not available',
};

/**
 * Prices one delivery from the admin's distance bands. Distance to the
 * warehouse picks the band; the slot can add the 2 hour charge. The
 * handling fee is added in every case.
 */
export function quoteDelivery(
  settings: Pick<ISettings, 'pricing' | 'twoHourCharge'> | null,
  input: { subtotal: number; distanceKm: number | null; slot: Slot; fallbackFee?: number },
): Quote {
  const pricing = settings?.pricing?.bands?.length ? settings.pricing : DEFAULTS;
  const handlingFee = pricing.handlingFee ?? DEFAULTS.handlingFee;
  const bands = [...pricing.bands].sort((a, b) => a.upToKm - b.upToKm);
  const { subtotal, distanceKm, slot } = input;

  let minOrder = bands[0].minOrder;
  let freeAbove = bands[0].freeAbove;
  let fee = bands[0].fee;
  let days = 0;
  let redOrder = false;
  let longDistance = false;

  if (distanceKm !== null) {
    const band = bands.find((b) => distanceKm <= b.upToKm);
    if (band) {
      minOrder = band.minOrder;
      freeAbove = band.freeAbove;
      fee = band.fee;
      days = band.nextDay ? 1 : 0;
      redOrder = band.redOrder;
    } else {
      const last = bands[bands.length - 1];
      minOrder = pricing.beyondMinOrder ?? last.minOrder;
      freeAbove = last.freeAbove;
      fee = last.fee;
      days = pricing.beyondDays ?? 3;
      longDistance = true;
    }
  }
  if (slot === 'nextDay' && days < 1) days = 1;

  const twoHourFee = slot === 'twoHour' && settings?.twoHourCharge?.enabled ? settings.twoHourCharge.amount : 0;
  const deliveryFee = subtotal >= freeAbove ? 0 : fee;
  const addForFree = Math.max(0, round2(freeAbove - subtotal));

  return {
    distanceKm: distanceKm === null ? null : round2(distanceKm),
    subtotal,
    minOrder,
    meetsMinOrder: subtotal >= minOrder,
    handlingFee,
    baseDeliveryFee: fee,
    deliveryFee,
    freeAbove,
    addForFree,
    twoHourFee,
    days,
    redOrder,
    longDistance,
    // Past the last band COD is refused, because a long run is too far to
    // send a rider out carrying cash. Product payment permissions are applied
    // on top of this by the cart/order controllers.
    codAllowed: !(longDistance && (pricing.beyondCodDisabled ?? true)),
    total: round2(subtotal + deliveryFee + handlingFee + twoHourFee),
  };
}

/** The payment choices with the admin's charges; any the admin never saved fall back to the defaults. */
export function paymentOptions(settings: Pick<ISettings, 'paymentOptions'> | null): PaymentOptionSetting[] {
  const saved = settings?.paymentOptions ?? [];
  return DEFAULT_PAYMENT_OPTIONS.map((d) => ({ ...d, ...(saved.find((s) => s.key === d.key) ?? {}) }));
}

/** The percent charged for this option on a bill of `amount`. */
export function paymentFeePct(option: PaymentOptionSetting | undefined, amount: number): number {
  if (!option) return 0;
  return option.highPct !== undefined && option.highPct !== null && option.highFrom && amount >= option.highFrom ? option.highPct : option.pct;
}

/** #36: what paying with `key` adds to a bill of `amount` (rupees, 2 decimals). */
export function paymentFee(settings: Pick<ISettings, 'paymentOptions'> | null, key: PayOption | undefined, amount: number): number {
  if (!key) return 0;
  const option = paymentOptions(settings).find((o) => o.key === key);
  return round2((amount * paymentFeePct(option, amount)) / 100);
}

/**
 * Point 8: cash on delivery is switched off every day after a cut-off time
 * (default 7 PM IST), controlled from the admin panel. Returns whether COD is
 * blocked right now and the message to show. Evaluated in IST (UTC+5:30).
 */
export function codTimeBlocked(
  settings: Pick<ISettings, 'cod'> | null,
  now: Date = new Date(),
): { enabled: boolean; time: string; blocked: boolean; message: string } {
  const cod = settings?.cod;
  const time = cod?.cutoffTime || '19:00';
  const message = cod?.cutoffMessage || 'After 7 PM COD option is not available';
  if (!cod?.cutoffEnabled) return { enabled: false, time, blocked: false, message };
  const [h, m] = time.split(':').map((n) => Number(n));
  const cutoffMin = (Number.isFinite(h) ? h : 19) * 60 + (Number.isFinite(m) ? m : 0);
  const IST = 330 * 60_000;
  const local = new Date(now.getTime() + IST);
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { enabled: true, time, blocked: nowMin >= cutoffMin, message };
}
