/** Normalizes the public numeric table identifiers used by table QR links. */
export function parseTableNumber(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value)) return null;

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return null;

  return String(number);
}
