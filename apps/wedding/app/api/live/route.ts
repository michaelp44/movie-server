import { NextResponse } from "next/server";
import { getLiveWallPayload } from "@/lib/live-wall/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getLiveWallPayload(), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Live wall feed failed", error);
    return NextResponse.json({ message: "העדכון הבא יגיע בעוד רגע" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
