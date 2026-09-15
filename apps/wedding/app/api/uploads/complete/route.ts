import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { markMediaUploadComplete } from "@/lib/data/guest-interactions";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.uuid(),
  completionToken: z.string().regex(/^[A-Za-z0-9_-]{24,64}$/),
});

async function requestIdentifier() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "unknown";
}

export async function POST(request: Request) {
  try {
    const rateLimit = await consumeRateLimit("upload-complete", await requestIdentifier(), 80, 15 * 60);
    if (!rateLimit.allowed) return NextResponse.json({ message: "נסו שוב מאוחר יותר" }, { status: 429 });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "בקשה לא תקינה" }, { status: 400 });

    const invitation = await getCurrentInvitation();
    await markMediaUploadComplete(parsed.data.id, parsed.data.completionToken, invitation?.id ?? null);
    return NextResponse.json({ success: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Upload completion failed", error);
    return NextResponse.json({ message: "לא הצלחנו להשלים את ההעלאה" }, { status: 400 });
  }
}
