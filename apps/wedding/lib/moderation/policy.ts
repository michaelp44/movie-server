import { z } from "zod";
import type { ModerationResult } from "./types";

export const moderationResultSchema = z.object({
  decision: z.enum(["approved", "review", "blocked"]),
  reason: z.string().min(1).max(500),
  categories: z.array(z.string().min(1).max(80)).max(12),
  confidence: z.number().min(0).max(1),
});

export function normalizeModerationResult(value: unknown): ModerationResult {
  const parsed = moderationResultSchema.parse(value);
  if (parsed.decision === "approved" && parsed.confidence < 0.8) {
    return { ...parsed, decision: "review", reason: "Low-confidence automated approval" };
  }
  return parsed;
}

export const moderationPrompt = `You moderate a private wedding projection wall. Be permissive with ordinary wedding content: guests, dancing, food, venue photos, selfies, group photos, affection, harmless jokes, mild party behavior, and normal congratulations should be approved. Block high-confidence nudity or explicit sexual content, graphic violence, hate or severe abuse, targeted humiliation, or clearly exposed credit cards, IDs, passports, medical/legal documents, passwords, phone numbers, addresses, or private chat screenshots. Use review when uncertain, when an image may expose private information, or when context is ambiguous. Do not over-moderate mild profanity or harmless humor. Return only the requested structured result. Never repeat private information in the reason.`;
