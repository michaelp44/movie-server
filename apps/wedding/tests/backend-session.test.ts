import { describe, expect, it } from "vitest";
import { signGuestSessionToken, verifyGuestSessionToken } from "@/lib/guest-session/token";

const secret = "test-secret-that-is-longer-than-thirty-two-bytes";
const invitationId = "10000000-0000-4000-8000-000000000001";
const now = new Date("2026-09-14T12:00:00Z");

describe("guest session token", () => {
  it("round-trips the invitation identity without PII", () => {
    const token = signGuestSessionToken(invitationId, secret, { now, ttlSeconds: 3600, nonce: "fixed-test-nonce-1234" });
    expect(token).not.toContain("050");
    expect(verifyGuestSessionToken(token, secret, new Date("2026-09-14T12:30:00Z"))).toEqual({ invitationId });
  });

  it("rejects tampered and expired tokens", () => {
    const token = signGuestSessionToken(invitationId, secret, { now, ttlSeconds: 60, nonce: "fixed-test-nonce-1234" });
    expect(verifyGuestSessionToken(`${token}x`, secret, now)).toBeNull();
    expect(verifyGuestSessionToken(token, secret, new Date("2026-09-14T12:02:00Z"))).toBeNull();
  });
});
