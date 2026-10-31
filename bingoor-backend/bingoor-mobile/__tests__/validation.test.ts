import { formatPrice, isValidEmail, isValidPhone, normalizePhone } from '../src/utils/validation';

describe('phone helpers', () => {
  test('normalizePhone strips spaces, dashes and +91', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('919876543210')).toBe('9876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  test('isValidPhone accepts Indian mobiles only', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('+919876543210')).toBe(true);
    expect(isValidPhone('1234567890')).toBe(false);
    expect(isValidPhone('98765')).toBe(false);
  });
});

describe('email and price helpers', () => {
  test('isValidEmail', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  test('formatPrice', () => {
    expect(formatPrice(45)).toBe('₹45');
    expect(formatPrice(45.5)).toBe('₹45.50');
  });
});
