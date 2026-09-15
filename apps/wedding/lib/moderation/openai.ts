import "server-only";
import { moderationPrompt, normalizeModerationResult } from "./policy";
import type { ModerationResult } from "./types";

type ModerationInput = { text?: string | null; imageUrl?: string | null; mediaKind?: "image" | "video" };

function review(reason: string): ModerationResult {
  return { decision: "review", reason, categories: ["moderation_unavailable"], confidence: 0 };
}

export async function moderateWeddingContent(
  input: ModerationInput,
  fetcher: typeof fetch = fetch,
): Promise<ModerationResult> {
  if (input.mediaKind === "video") return review("Video requires manual review");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return review("AI moderation is not configured");

  const content: Array<Record<string, string>> = [{
    type: "input_text",
    text: `${moderationPrompt}\n\nGuest message: ${input.text?.trim() || "(none)"}`,
  }];
  if (input.imageUrl) content.push({ type: "input_image", image_url: input.imageUrl, detail: "low" });

  try {
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODERATION_MODEL || "gpt-5-mini",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "wedding_moderation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                decision: { type: "string", enum: ["approved", "review", "blocked"] },
                reason: { type: "string" },
                categories: { type: "array", items: { type: "string" } },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["decision", "reason", "categories", "confidence"],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return review(`AI moderation failed (${response.status})`);
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) return review("AI moderation returned no decision");
    return normalizeModerationResult(JSON.parse(text));
  } catch (error) {
    console.error("AI moderation request failed", error);
    return review("AI moderation request failed");
  }
}
