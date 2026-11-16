import crypto from 'crypto';
import { Types } from 'mongoose';

export const isObjectId = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

/** Filter that matches a document by _id or by slug, depending on what the value looks like. */
export const idOrSlugFilter = (value: string): { _id: string } | { slug: string } =>
  isObjectId(value) ? { _id: value } : { slug: value.toLowerCase() };

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const uniqueSlug = (text: string): string =>
  `${slugify(text) || 'item'}-${crypto.randomBytes(3).toString('hex')}`;

export const toObjectId = (id: string) => new Types.ObjectId(id);

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** True for a MongoDB duplicate-key error (a unique index refused the write). */
export const isDuplicateKey = (e: unknown): boolean => (e as { code?: number } | null)?.code === 11000;
