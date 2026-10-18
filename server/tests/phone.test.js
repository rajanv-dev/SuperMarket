const { normalizePhoneNumber, toDigitsOnly, maskPhoneNumber, isValidPhone } = require('../src/utils/phone');

describe('Phone Number Utilities', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes standard 10-digit Indian numbers with +91', () => {
      expect(normalizePhoneNumber('9894508265')).toBe('+919894508265');
      expect(normalizePhoneNumber('8123456789')).toBe('+918123456789');
      expect(normalizePhoneNumber('7012345678')).toBe('+917012345678');
      expect(normalizePhoneNumber('6312345678')).toBe('+916312345678');
    });

    it('strips formatting like spaces, hyphens, and parentheses', () => {
      expect(normalizePhoneNumber('98945 08265')).toBe('+919894508265');
      expect(normalizePhoneNumber('989-450-8265')).toBe('+919894508265');
      expect(normalizePhoneNumber('(989) 450-8265')).toBe('+919894508265');
      expect(normalizePhoneNumber('+91 98945-08265')).toBe('+919894508265');
    });

    it('handles 0-prefixed trunk mobile numbers', () => {
      expect(normalizePhoneNumber('09894508265')).toBe('+919894508265');
    });

    it('handles 91-prefixed numbers without +', () => {
      expect(normalizePhoneNumber('919894508265')).toBe('+919894508265');
    });

    it('preserves existing non-Indian international country codes without prepending +91', () => {
      expect(normalizePhoneNumber('+1 555-195-3562')).toBe('+15551953562');
      expect(normalizePhoneNumber('+44 7911 123456')).toBe('+447911123456');
      expect(normalizePhoneNumber('+971 50 123 4567')).toBe('+971501234567');
    });

    it('handles 00 international prefix', () => {
      expect(normalizePhoneNumber('0015551953562')).toBe('+15551953562');
    });

    it('returns empty string for invalid or empty inputs', () => {
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
    });
  });

  describe('toDigitsOnly', () => {
    it('returns international digits without plus for WhatsApp Cloud API', () => {
      expect(toDigitsOnly('9894508265')).toBe('919894508265');
      expect(toDigitsOnly('+91 98945 08265')).toBe('919894508265');
      expect(toDigitsOnly('+1 555 195 3562')).toBe('15551953562');
    });
  });

  describe('maskPhoneNumber', () => {
    it('masks phone number for privacy-safe logs', () => {
      const masked = maskPhoneNumber('+919894508265');
      expect(masked.startsWith('+9198')).toBe(true);
      expect(masked.endsWith('8265')).toBe(true);
      expect(masked.includes('*')).toBe(true);
    });

    it('handles short or empty numbers gracefully', () => {
      expect(maskPhoneNumber('')).toBe('N/A');
      expect(maskPhoneNumber('123')).toBe('***');
    });
  });

  describe('isValidPhone', () => {
    it('validates phone length', () => {
      expect(isValidPhone('9894508265')).toBe(true);
      expect(isValidPhone('+919894508265')).toBe(true);
      expect(isValidPhone('12345')).toBe(false);
    });
  });
});
