/* Ambiguous characters are left out on purpose: a generated password is often written on paper
   or read down a phone line, and 0/O, 1/l/I cost more support calls than the extra combinations are worth. */
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '@#$%&*!?';
const LENGTH = 12;

/** A random index below `max`; uses the platform's secure generator when it has one. */
function pick(max: number): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let n = 0;
    do {
      c.getRandomValues(buf);
      n = buf[0];
    } while (n >= limit);
    return n % max;
  }
  return Math.floor(Math.random() * max);
}

/** A 12 character password with a lower, upper, digit and symbol in it. */
export function generatePassword(): string {
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  const chars = [LOWER[pick(LOWER.length)], UPPER[pick(UPPER.length)], DIGIT[pick(DIGIT.length)], SYMBOL[pick(SYMBOL.length)]];
  while (chars.length < LENGTH) chars.push(all[pick(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
