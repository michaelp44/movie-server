const INVISIBLE_DIRECTION_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const ALLOWED_PHONE_PUNCTUATION = /[\s().\-/]/g;

/**
 * Canonical format used by the wedding database (E.164 without extensions).
 *
 * Supported Israeli geographic, mobile, VoIP and kosher-mobile prefixes are
 * normalized. Service and premium-rate numbers are intentionally rejected.
 */
export function normalizeIsraeliPhone(input: string): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const compact = input
    .normalize("NFKC")
    .replace(INVISIBLE_DIRECTION_MARKS, "")
    .trim()
    .replace(ALLOWED_PHONE_PUNCTUATION, "");

  if (!compact || /[^+\d]/.test(compact) || (compact.match(/\+/g)?.length ?? 0) > 1) {
    return null;
  }

  let digits = compact;

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("00972")) {
    digits = digits.slice(5);
  } else if (digits.startsWith("972")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (!/^[57]\d{8}$/.test(digits)) {
    // Sheets may drop the leading zero from a local mobile number.
    return null;
  }

  // +972 5X/7X XXX XXXX (mobile/VoIP) or +972 2/3/4/8/9 XXX XXXX
  const isMobileOrVoip = /^[57]\d{8}$/.test(digits);
  const isGeographic = /^[23489]\d{7}$/.test(digits);

  if (!isMobileOrVoip && !isGeographic) {
    return null;
  }

  // Reject obvious placeholders while retaining otherwise valid test ranges.
  if (/^(\d)\1+$/.test(digits) || /^[57](\d)\1{7}$/.test(digits)) {
    return null;
  }

  return `+972${digits}`;
}

export function isCanonicalIsraeliPhone(input: string): boolean {
  return normalizeIsraeliPhone(input) === input;
}

export function normalizeIsraeliPhoneOrThrow(input: string): string {
  const normalized = normalizeIsraeliPhone(input);

  if (!normalized) {
    throw new TypeError("Invalid Israeli phone number");
  }

  return normalized;
}
