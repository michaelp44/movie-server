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

  it.each(["", "1234", "+12025550123", "050-ABC-4567", "0500000000", "++972501234567"])(
    "rejects invalid input %s",
    (input) => expect(normalizeIsraeliPhone(input)).toBeNull(),
  );

  it("recognizes canonical Israeli values", () => {
    expect(isCanonicalIsraeliPhone("+972501234567")).toBe(true);
    expect(isCanonicalIsraeliPhone("0501234567")).toBe(false);
  });
});
