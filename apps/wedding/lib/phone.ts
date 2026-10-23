const INVISIBLE_DIRECTION_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const ALLOWED_PHONE_PUNCTUATION = /[\s().\-/]/g;

/**
 * Canonical format used by the wedding database: E.164 with a leading plus.
 * National-format Israeli numbers are normalized to +972; explicit international
 * numbers are retained as E.164. Extensions and service numbers are rejected.
 */
export function normalizeIsraeliPhone(input: string): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const compact = input
    .normalize("NFKC")
    .replace(INVISIBLE_DIRECTION_MARKS, "")
    .trim()
    // Some Sheets store phone numbers as formulas like =+390... .
    .replace(/^=/, "")
    .replace(ALLOWED_PHONE_PUNCTUATION, "");

  if (!compact || /[^+\d]/.test(compact) || (compact.match(/\+/g)?.length ?? 0) > 1) {
    return null;
  }

  const explicitInternational = compact.startsWith("+") || compact.startsWith("00");
  let digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Preserve support for Israeli numbers entered without the country code.
  if (!explicitInternational && digits.startsWith("0")) digits = digits.slice(1);
  else if (!explicitInternational && digits.startsWith("972")) digits = digits.slice(3);
  else if (!explicitInternational && /^[1-9]\d{10,14}$/.test(digits)) {
    // A few Sheets cells contain an E.164 number as digits without the leading plus.
    return `+${digits}`;
  } else if (!explicitInternational && !/^[57]\d{8}$/.test(digits)) {
    // Sheets may drop the leading zero from an Israeli mobile number.
    return null;
  }

  if (explicitInternational && !digits.startsWith("972")) {
    if (!/^[1-9]\d{7,14}$/.test(digits) || /^([1-9])\1+$/.test(digits)) return null;
    return `+${digits}`;
  }
  if (digits.startsWith("972")) digits = digits.slice(3);

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
