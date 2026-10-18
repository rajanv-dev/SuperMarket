/**
 * Phone Number Utilities for VRK Supermarket
 * Handles international normalization, Indian mobile formats, and privacy-safe masking.
 */

/**
 * Normalizes a customer phone number into E.164 international format (+<country><number>).
 * - Converts Indian 10-digit mobile numbers (starting with 6-9) to +91XXXXXXXXXX.
 * - Converts 0-prefixed 10-digit numbers (0XXXXXXXXXX) to +91XXXXXXXXXX.
 * - Converts 91-prefixed 10-digit numbers without '+' (91XXXXXXXXXX) to +91XXXXXXXXXX.
 * - Retains existing international country codes without prepending +91.
 * - Strips all formatting characters (spaces, dashes, parentheses, dots).
 *
 * @param {string} rawPhone
 * @returns {string} E.164 formatted phone number or original cleaned digits
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';

  // Strip whitespace, hyphens, parentheses, and dots
  const cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();
  if (!cleaned) return '';

  // Already starts with '+'
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Starts with '00' international prefix
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2)}`;
  }

  // 12 digits starting with Indian country code '91'
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 11 digits starting with trunk prefix '0' (09876543210)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // Standard 10-digit Indian mobile number (e.g., 9894508265)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Any other 10-digit number defaults to Indian mobile context for domestic supermarket
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Fallback: prepend '+' if it appears to be a raw international number
  if (/^\d{11,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
}

/**
 * Extracts digits-only international number for APIs like Meta WhatsApp Cloud API
 * which often require '919894508265' without the leading '+'.
 *
 * @param {string} phone
 * @returns {string}
 */
function toDigitsOnly(phone) {
  const normalized = normalizePhoneNumber(phone);
  return normalized.replace(/\D/g, '');
}

/**
 * Masks a phone number for privacy-safe diagnostic logging.
 * Example: +919894508265 -> +91 98****8265
 *
 * @param {string} phone
 * @returns {string}
 */
function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return 'N/A';
  const clean = phone.trim();
  if (clean.length <= 6) return '***';

  const visibleStart = clean.slice(0, 5);
  const visibleEnd = clean.slice(-4);
  const maskedLength = Math.max(2, clean.length - 9);
  const asterisks = '*'.repeat(maskedLength);

  return `${visibleStart}${asterisks}${visibleEnd}`;
}

/**
 * Validates whether the given string is a plausible phone number
 *
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

module.exports = {
  normalizePhoneNumber,
  toDigitsOnly,
  maskPhoneNumber,
  isValidPhone,
};
