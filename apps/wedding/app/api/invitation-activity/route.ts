import { z } from "zod";

import { consumeRateLimit } from "@/lib/rate-limit";
import { readGuestSession } from "@/lib/guest-session";
import { recordInvitationActivity } from "@/lib/rsvp/activity";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const eventSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/).optional(),
  target: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return new Response(null, { status: 413 });

  let payload: unknown;
  try { payload = await request.json(); } catch { return new Response(null, { status: 400 }); }
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });

  try {
    const db = createAdminClient({ optional: true });
    if (!db) return new Response(null, { status: 503 });
    const session = parsed.data.token ? null : await readGuestSession();
    if (!parsed.data.token && !session) return new Response(null, { status: 401 });
    const identifier = `${parsed.data.token ?? session?.invitationId}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;
    const limit = await consumeRateLimit("invitation-activity", identifier, 120, 15 * 60);
    if (!limit.allowed) return new Response(null, { status: 429 });
    const { data, error } = parsed.data.token
      ? await db.from("invitations").select("id, display_name").eq("secure_token", parsed.data.token).maybeSingle()
      : await db.from("invitations").select("id, display_name").eq("id", session!.invitationId).maybeSingle();
    if (error || !data) return new Response(null, { status: 404 });
    const recorded = await recordInvitationActivity({ invitationId: data.id, displayName: data.display_name, eventType: "interaction", target: parsed.data.target });
    return new Response(null, { status: recorded ? 204 : 503 });
  } catch (error) {
    console.error("Invitation activity request failed", error);
    return new Response(null, { status: 503 });
  }
}
