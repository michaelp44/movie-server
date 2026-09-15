import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { fallbackRequest, isFallbackConfigured, operationId } from "@/lib/fallback/client";

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
    const id = operationId();
    const mirror = { operationId: id, id, invitationId: invitation?.id ?? null, sessionHash, emoji: parsed.data.emoji };
    const db = createAdminClient({ optional: true });
    if (!db) await fallbackRequest("/v1/reactions", { method: "POST", body: mirror });
    else {
      try {
        const { error } = await db.from("live_wall_reactions").insert({ id, invitation_id: invitation?.id ?? null, session_hash: sessionHash, emoji: parsed.data.emoji });
        if (error) throw error;
        if (isFallbackConfigured()) await fallbackRequest("/v1/reactions", { method: "POST", timeoutMs: 2_000, body: mirror }).catch((error) => console.error("Fallback reaction mirror failed", error));
      } catch (error) {
        if (!isFallbackConfigured()) throw error;
        await fallbackRequest("/v1/reactions", { method: "POST", body: mirror });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Live reaction failed", error);
    return NextResponse.json({ message: "התגובה לא נשלחה כרגע" }, { status: 503 });
  }
}
