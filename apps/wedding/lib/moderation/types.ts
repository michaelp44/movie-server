export type ModerationDecision = "approved" | "review" | "blocked";

export type ModerationResult = {
  decision: ModerationDecision;
  reason: string;
  categories: string[];
  confidence: number;
};

export type ModerationStatus = "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "BLOCKED";

export function decisionToStatus(decision: ModerationDecision): ModerationStatus {
  return decision === "approved" ? "APPROVED" : decision === "blocked" ? "BLOCKED" : "NEEDS_REVIEW";
}
