import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GALLERY_VISITOR_COOKIE, hashGalleryVisitor } from "@/lib/gallery-likes";
import { getCurrentInvitation } from "@/lib/guest-data";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const photoIdSchema = z.string().uuid();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const parsed = photoIdSchema.safeParse(rawId);
    if (!parsed.success) return NextResponse.json({ message: "התמונה לא נמצאה" }, { status: 404 });

    const requestHeaders = await headers();
    const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await consumeRateLimit("gallery-like", identifier, 30, 60)).allowed) {
      return NextResponse.json({ message: "קצת לאט עם הלבבות ❤️" }, { status: 429 });
    }

    const cookieStore = await cookies();
    const visitorToken = cookieStore.get(GALLERY_VISITOR_COOKIE)?.value ?? randomUUID();
    const visitorHash = hashGalleryVisitor(visitorToken);
    const db = createAdminClient();
    const { data: photo } = await db.from("photo_uploads").select("id").eq("id", parsed.data).eq("approved", true).eq("rejected", false).eq("upload_completed", true).is("hidden_at", null).maybeSingle();
    if (!photo) return NextResponse.json({ message: "התמונה לא נמצאה" }, { status: 404 });

    const { data: existing, error: existingError } = await db.from("photo_likes").select("id").eq("photo_id", parsed.data).eq("visitor_hash", visitorHash).maybeSingle();
    if (existingError) throw existingError;
    let liked = false;
    if (existing) {
      const { error } = await db.from("photo_likes").delete().eq("id", existing.id);
      if (error) throw error;
    } else {
      const invitation = await getCurrentInvitation();
      const { error } = await db.from("photo_likes").insert({ photo_id: parsed.data, visitor_hash: visitorHash, invitation_id: invitation?.id ?? null });
      if (error && error.code !== "23505") throw error;
      liked = true;
    }

    const { count } = await db.from("photo_likes").select("id", { count: "exact", head: true }).eq("photo_id", parsed.data);
    const response = NextResponse.json({ liked, likeCount: count ?? 0 }, { headers: { "cache-control": "private, no-store" } });
    response.cookies.set(GALLERY_VISITOR_COOKIE, visitorToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    console.error("Gallery like failed", error);
    return NextResponse.json({ message: "לא הצלחנו לעדכן את הלייק כרגע" }, { status: 503 });
  }
}
