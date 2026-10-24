/** Strips spaces/dashes and a +91 / 91 prefix -> 10 digit Indian mobile number. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, '');
}

export const isValidPhone = (value: string): boolean => /^[6-9]\d{9}$/.test(normalizePhone(value));

export const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function formatPrice(value: number): string {
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
}
