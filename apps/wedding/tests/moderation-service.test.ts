import { afterEach, describe, expect, it, vi } from "vitest";
import { moderateWeddingContent } from "@/lib/moderation/openai";

function responseFor(result: object) {
  return vi.fn(async () => new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(result) }] }] }), { status: 200 })) as unknown as typeof fetch;
}

afterEach(() => vi.unstubAllEnvs());

describe("AI moderation service", () => {
  it.each([
    ["approved", "approved"],
    ["review", "review"],
    ["blocked", "blocked"],
  ] as const)("returns %s decisions", async (decision, expected) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const result = await moderateWeddingContent({ text: "test" }, responseFor({ decision, reason: "policy result", categories: [], confidence: 0.95 }));
    expect(result.decision).toBe(expected);
  });

  it("fails safe when the provider errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const result = await moderateWeddingContent({ text: "test" }, vi.fn(async () => new Response("error", { status: 500 })) as unknown as typeof fetch);
    expect(result.decision).toBe("review");
  });

  it("never auto-approves video", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    expect((await moderateWeddingContent({ mediaKind: "video" })).decision).toBe("review");
  });
});
