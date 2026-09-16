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

  it("keeps a video unpublished when a server preview is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    expect((await moderateWeddingContent({ mediaKind: "video" })).decision).toBe("review");
  });

  it("moderates a video when a server-generated preview is available", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const result = await moderateWeddingContent(
      { mediaKind: "video", imageUrl: "https://example.com/video-preview.jpg" },
      responseFor({ decision: "approved", reason: "safe wedding video frame", categories: [], confidence: 0.93 }),
    );
    expect(result.decision).toBe("approved");
  });

  it("sends images at high detail and explicitly checks obscene gestures", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let requestBody = "";
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ decision: "review", reason: "obscene gesture", categories: ["obscene_gesture"], confidence: 0.96 }) }] }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await moderateWeddingContent({ mediaKind: "image", imageUrl: "https://example.com/photo.jpg" }, fetcher);
    const body = JSON.parse(requestBody) as { input: Array<{ content: Array<{ detail?: string; text?: string }> }> };
    expect(body.input[0]?.content.some((part) => part.detail === "high")).toBe(true);
    expect(body.input[0]?.content.some((part) => part.text?.includes("middle finger"))).toBe(true);
  });
});
