import { headers } from "next/headers";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { markMediaUploadComplete } from "@/lib/data/guest-interactions";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  id: z.uuid(),
  completionToken: z.string().regex(/^[A-Za-z0-9_-]{24,64}$/),
  backend: z.enum(["supabase", "fallback"]).default("supabase"),
});

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

async function requestIdentifier() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "unknown";
}

export async function POST(request: Request) {
  try {
    const rateLimit = await consumeRateLimit("upload-complete", await requestIdentifier(), 80, 15 * 60);
    if (!rateLimit.allowed) return privateJson({ message: "נסו שוב מאוחר יותר" }, 429);

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return privateJson({ message: "בקשה לא תקינה" }, 400);

    const invitation = await getCurrentInvitation();
    const completion = await markMediaUploadComplete(parsed.data.id, parsed.data.completionToken, invitation?.id ?? null, parsed.data.backend);
    after(async () => {
      try {
        await completion.moderate();
      } catch (error) {
        console.error("Background upload moderation failed", error);
      }
    });
    return privateJson({ success: true, moderationStatus: completion.moderationStatus });
  } catch (error) {
    console.error("Upload completion failed", error);
    return privateJson({ message: "לא הצלחנו להשלים את ההעלאה" }, 400);
  }
}
