import { after, NextResponse } from "next/server";
import { getLiveWallPayload } from "@/lib/live-wall/data";
import { maybeGenerateLiveWallIllustration } from "@/lib/live-wall/illustration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET() {
  try {
    const payload = await getLiveWallPayload();
    after(() => maybeGenerateLiveWallIllustration().catch((error) => console.error("Live Wall illustration task failed", error)));
    return NextResponse.json(payload, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Live wall feed failed", error);
    return NextResponse.json({ message: "העדכון הבא יגיע בעוד רגע" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
