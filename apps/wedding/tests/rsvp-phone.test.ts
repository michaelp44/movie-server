import { describe, expect, it } from "vitest";
import { displayIsraeliPhone, phoneCallHref } from "@/lib/rsvp/phone";

describe("RSVP phone calls", () => {
  it("builds a normal cellular call link", () => {
    expect(phoneCallHref("+972503062269", false)).toBe("tel:+972503062269");
  });

  it("encodes the caller-ID suppression prefix without turning it into a URL fragment", () => {
    expect(phoneCallHref("+972503062269", true)).toBe("tel:%2331%23+972503062269");
  });

  it("renders a canonical Israeli number locally", () => {
    expect(displayIsraeliPhone("+972503062269")).toBe("0503062269");
  });
});
