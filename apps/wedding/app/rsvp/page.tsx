import { redirect } from "next/navigation";

import { readGuestSession } from "@/lib/guest-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CurrentGuestRsvpPage() {
  const session = await readGuestSession();
  if (!session) redirect("/?rsvp=identify");
  const db = createAdminClient({ optional: true });
  if (!db) redirect("/?rsvp=unavailable");
  const { data } = await db.from("invitations").select("secure_token").eq("id", session.invitationId).maybeSingle();
  if (!data?.secure_token) redirect("/?rsvp=unavailable");
  redirect(`/rsvp/${encodeURIComponent(data.secure_token)}`);
}

