import { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { Category } from '../models/Category';
import { ISettings, Settings } from '../models/Settings';

/**
 * Shop-wide settings plus the category rules derived from them, cached in
 * memory. The rules are looked up for every product card, so they are
 * resolved once (which aisles - including every child aisle - deliver in
 * N days, and where COD is off) and then read synchronously.
 */
type SettingsLean = ISettings & { _id: Types.ObjectId };

interface Cache {
  at: number;
  settings: SettingsLean;
  sixDay: Set<string>;
  codOff: Set<string>;
}

const TTL_MS = 30_000;
let cache: Cache | null = null;
let loading: Promise<Cache> | null = null;

/** Every category id at or below the given ones (three levels deep). */
async function withDescendants(roots: Types.ObjectId[]): Promise<Set<string>> {
  const ids = new Set(roots.map(String));
  let frontier = roots;
  for (let depth = 0; depth < 2 && frontier.length; depth++) {
    const kids = await Category.find({ parent: { $in: frontier } }).select('_id').lean();
    frontier = kids.map((k) => k._id as Types.ObjectId);
    frontier.forEach((id) => ids.add(String(id)));
  }
  return ids;
}

export async function getSettingsDoc(): Promise<SettingsLean> {
  // Not lean, so fields added to the schema after the settings were first saved get their defaults.
  const found = await Settings.findOne({ key: 'global' });
  if (found) return found.toObject() as SettingsLean;
  // First run: create the defaults. Fruits & vegetables start with COD off, as requested.
  const fruitVeg = await Category.findOne({ level: 2, name: /vegetables|fruits/i }).select('_id').lean();
  const created = await Settings.create({
    key: 'global',
    cod: fruitVeg ? { disabledCategories: [fruitVeg._id] } : undefined,
  });
  return created.toObject() as SettingsLean;
}

async function build(): Promise<Cache> {
  const settings = await getSettingsDoc();
  const [sixDay, codOff] = await Promise.all([
    withDescendants(settings.sixDay?.categories ?? []),
    withDescendants(settings.cod?.disabledCategories ?? []),
  ]);
  return { at: Date.now(), settings, sixDay, codOff };
}

export async function loadSettings(): Promise<Cache> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  loading ??= build().finally(() => {
    loading = null;
  });
  cache = await loading;
  return cache;
}

export function clearSettingsCache() {
  cache = null;
}

/** Makes the rules available synchronously to everything after it. */
export const ensureSettings: RequestHandler = (_req, _res, next) => {
  loadSettings().then(() => next(), next);
};

const idOf = (category: unknown): string | null => {
  if (!category) return null;
  if (typeof category === 'object' && '_id' in (category as object)) return String((category as { _id: unknown })._id);
  return String(category);
};

/** Delivery promise and COD availability for a product in this category. */
export type PaymentMode = 'both' | 'cod' | 'online';

export function productRules(
  category: unknown,
  paymentMode?: PaymentMode | null,
): { deliveryDays: number | null; codAvailable: boolean; onlineAvailable: boolean; paymentMode: PaymentMode } {
  const id = idOf(category);
  const mode: PaymentMode = paymentMode === 'cod' || paymentMode === 'online' ? paymentMode : 'both';
  const aisleCod = !cache || !id ? true : !cache.codOff.has(id);
  return {
    deliveryDays: cache && id && cache.sixDay.has(id) ? cache.settings.sixDay.days : null,
    // A product set to "online only" never takes cash and "COD only" always does.
    // "both" is the schema default every product has, so it must not override the
    // admin's "no cash on delivery" aisles - otherwise that tick never applies.
    codAvailable: mode === 'online' ? false : mode === 'cod' ? true : aisleCod,
    onlineAvailable: mode !== 'cod',
    paymentMode: mode,
  };
}

export function codMessage(): string {
  return cache?.settings.cod?.message ?? 'Cash on delivery is not available for some items in your cart.';
}

/** Why COD is off when the customer is simply too far away. */
export function longDistanceCodMessage(): string {
  return (
    cache?.settings.pricing?.beyondCodMessage ?? 'For long distance "COD" option is not available'
  );
}

export function cachedSettings(): SettingsLean | null {
  return cache?.settings ?? null;
}
