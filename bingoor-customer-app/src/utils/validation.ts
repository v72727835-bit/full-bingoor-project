/** Strips spaces/dashes and a +91 / 91 prefix -> 10 digit Indian mobile number. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, '');
}

export const isValidPhone = (value: string): boolean => /^[6-9]\d{9}$/.test(normalizePhone(value));

export const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidPincode = (value: string): boolean => /^\d{6}$/.test(value.trim());

export function formatPrice(value: number): string {
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/**
 * Rough password strength, used to drive the meter on the signup form.
 * Deliberately simple: the server is the real gate, this is only guidance.
 */
export function passwordStrength(value: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (value.length < 8) return { score: 0, label: 'Too short' };
  let score = 1;
  if (value.length >= 10) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value)) score += 1;
  const labels = ['Too short', 'Weak', 'Good', 'Strong'] as const;
  const clamped = Math.min(score, 3) as 0 | 1 | 2 | 3;
  return { score: clamped, label: labels[clamped] };
}

/** "2 Feb 2026, 4:30 pm" - short, unambiguous, no external date library. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

/** "just now" / "12 min ago" / "3 days ago" - falls back to a date after a week. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
