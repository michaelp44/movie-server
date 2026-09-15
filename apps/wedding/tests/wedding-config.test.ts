import { describe, expect, it } from "vitest";
import { getCalendarEvent, weddingConfig } from "@/lib/wedding-config";

describe("production wedding configuration", () => {
  it("contains the verified venue and navigation destinations", () => {
    expect(weddingConfig.venue).toMatchObject({ name: expect.stringContaining("5.91"), address: expect.stringContaining("עובד בן עמי 2"), isPlaceholder: false });
    expect(new URL(weddingConfig.maps.waze).hostname).toContain("waze.com");
    expect(new URL(weddingConfig.maps.googleMaps).hostname).toContain("google.com");
  });

  it("includes the venue in calendar exports and the configured Bit phone", () => {
    expect(getCalendarEvent().location).toContain("5.91");
    expect(weddingConfig.gift.bitPhone).toBe("0503062269");
  });
});
