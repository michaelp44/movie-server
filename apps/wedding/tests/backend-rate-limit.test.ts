import { beforeEach, describe, expect, it } from "vitest";
import { clearLocalRateLimits, consumeLocalRateLimit } from "@/lib/rate-limit/local";

describe("local rate-limit fallback", () => {
  beforeEach(clearLocalRateLimits);

  it("allows up to the configured threshold and then blocks", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    expect(consumeLocalRateLimit("lookup", "hash", 2, 60, now).allowed).toBe(true);
    expect(consumeLocalRateLimit("lookup", "hash", 2, 60, now).allowed).toBe(true);
    expect(consumeLocalRateLimit("lookup", "hash", 2, 60, now).allowed).toBe(false);
  });

  it("resets in the next fixed window", () => {
    consumeLocalRateLimit("lookup", "hash", 1, 60, new Date("2026-09-14T12:00:30Z"));
    expect(consumeLocalRateLimit("lookup", "hash", 1, 60, new Date("2026-09-14T12:01:01Z")).allowed).toBe(true);
  });
});
