import { describe, expect, it } from "vitest";
import { normalizeModerationResult } from "@/lib/moderation/policy";
import { decisionToStatus } from "@/lib/moderation/types";

describe("wedding moderation policy", () => {
  it("maps decisions to publication states", () => {
    expect(decisionToStatus("approved")).toBe("APPROVED");
    expect(decisionToStatus("review")).toBe("NEEDS_REVIEW");
    expect(decisionToStatus("blocked")).toBe("BLOCKED");
  });

  it("sends low-confidence approvals to review", () => {
    expect(normalizeModerationResult({ decision: "approved", reason: "likely safe", categories: [], confidence: 0.62 }).decision).toBe("review");
  });

  it("keeps high-confidence safe and unsafe decisions", () => {
    expect(normalizeModerationResult({ decision: "approved", reason: "wedding selfie", categories: [], confidence: 0.96 }).decision).toBe("approved");
    expect(normalizeModerationResult({ decision: "blocked", reason: "private ID", categories: ["private_document"], confidence: 0.94 }).decision).toBe("blocked");
  });
});
