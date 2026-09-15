import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ emoji: z.enum(["❤️", "🔥", "😂", "🥂"]) });

export async function POST(request: Request) {
  try {
    const requestHeaders = await headers();
    const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await consumeRateLimit("live-reaction", identifier, 12, 60)).allowed) return NextResponse.json({ message: "רגע קטן בין תגובות ❤️" }, { status: 429 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "תגובה לא תקינה" }, { status: 400 });
    const invitation = await getCurrentInvitation();
    const secret = process.env.RATE_LIMIT_HASH_SECRET ?? process.env.GUEST_SESSION_SECRET ?? "unconfigured-wedding-reaction-secret";
    const sessionHash = createHash("sha256").update(`${secret}:${identifier}`).digest("hex");
    const db = createAdminClient();
    const { error } = await db.from("live_wall_reactions").insert({ invitation_id: invitation?.id ?? null, session_hash: sessionHash, emoji: parsed.data.emoji });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Live reaction failed", error);
    return NextResponse.json({ message: "התגובה לא נשלחה כרגע" }, { status: 503 });
  }
}
