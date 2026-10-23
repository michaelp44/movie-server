import { describe, expect, it } from "vitest";
import { isCanonicalIsraeliPhone, normalizeIsraeliPhone } from "@/lib/phone";

describe("normalizeIsraeliPhone", () => {
  it.each([
    "0501234567",
    "050-123-4567",
    "050 123 4567",
    "+972501234567",
    "972501234567",
    "00972 50 123 4567",
    "501234567",
  ])("normalizes %s to the same E.164 value", (input) => {
    expect(normalizeIsraeliPhone(input)).toBe("+972501234567");
  });

  it.each(["", "1234", "050-ABC-4567", "0500000000", "++972501234567", "+00012345678", "+1234567", "+1234567890123456"])(
    "rejects invalid input %s",
    (input) => expect(normalizeIsraeliPhone(input)).toBeNull(),
  );

  it("recognizes canonical Israeli values", () => {
    expect(isCanonicalIsraeliPhone("+972501234567")).toBe(true);
    expect(isCanonicalIsraeliPhone("0501234567")).toBe(false);
  });

  it.each([
    ["+380674931667", "+380674931667"],
    ["=+393339310560", "+393339310560"],
    ["+1 (336) 312-5549", "+13363125549"],
    ["004917662159796", "+4917662159796"],
    ["+41783021929", "+41783021929"],
  ])("normalizes international number %s", (input, expected) => {
    expect(normalizeIsraeliPhone(input)).toBe(expected);
  });
});
