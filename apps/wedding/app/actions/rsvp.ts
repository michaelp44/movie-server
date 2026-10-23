"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { createGuestSession } from "@/lib/guest-session";
import { writeSyncedInvitationRsvp } from "@/lib/google-sheets";
import { consumeRateLimit } from "@/lib/rate-limit";
import { rsvpDetailsSchema } from "@/lib/rsvp/details";
import { recordInvitationActivity } from "@/lib/rsvp/activity";
import { createAdminClient } from "@/lib/supabase/admin";

const responseSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  status: z.enum(["confirmed", "declined"]),
  numberConfirmed: z.coerce.number().int().min(0),
  note: z.string().trim().max(500).optional(),
});

function resultUrl(token: string, result: "success" | "error") {
  return `/rsvp/${encodeURIComponent(token)}?result=${result}`;
}

export async function submitRsvpAction(formData: FormData): Promise<void> {
  const parsed = responseSchema.safeParse({
    token: formData.get("token"),
    status: formData.get("status"),
    numberConfirmed: formData.get("numberConfirmed"),
    note: formData.get("note"),
  });
  if (!parsed.success) redirect("/?rsvp=error");

  const detailsResult = rsvpDetailsSchema.safeParse({
    adults: formData.get("adults"),
    children: formData.get("children"),
    infants: formData.get("infants"),
    transport: formData.get("transport"),
    dietary: formData.getAll("dietary"),
    dietaryCounts: (() => {
      try { return JSON.parse(String(formData.get("dietaryCounts") ?? "{}")); } catch { return {}; }
    })(),
    allergyNote: formData.get("allergyNote") ?? "",
  });

  const requestHeaders = await headers();
  const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? requestHeaders.get("x-real-ip")
    ?? "unknown";
  const limit = await consumeRateLimit("rsvp-response", identifier, 12, 15 * 60);
  if (!limit.allowed) redirect(resultUrl(parsed.data.token, "error"));

  const db = createAdminClient();
  const { data: invitation, error } = await db
    .from("invitations")
    .select("id, source_row_id, display_name")
    .eq("secure_token", parsed.data.token)
    .maybeSingle();
  if (error || !invitation) redirect(resultUrl(parsed.data.token, "error"));

  if (!detailsResult.success && parsed.data.status === "confirmed") {
    await recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.display_name, eventType: "rsvp_failed", target: "invalid_details" });
    redirect(resultUrl(parsed.data.token, "error"));
  }

  const confirmed = parsed.data.status === "declined" ? 0 : parsed.data.numberConfirmed;
  if (parsed.data.status === "confirmed" && confirmed < 1) {
    await recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.display_name, eventType: "rsvp_failed", target: "invalid_count" });
    redirect(resultUrl(parsed.data.token, "error"));
  }
  if (parsed.data.status === "confirmed" && detailsResult.success &&
    detailsResult.data.adults + detailsResult.data.children + detailsResult.data.infants !== confirmed) {
    await recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.display_name, eventType: "rsvp_failed", target: "count_mismatch" });
    redirect(resultUrl(parsed.data.token, "error"));
  }
  if (parsed.data.status === "confirmed" && detailsResult.success && detailsResult.data.dietary.some((value) =>
    (detailsResult.data.dietaryCounts?.[value] ?? 0) > confirmed || (detailsResult.data.dietaryCounts?.[value] ?? 0) < 1)) {
    await recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.display_name, eventType: "rsvp_failed", target: "invalid_dietary_count" });
    redirect(resultUrl(parsed.data.token, "error"));
  }

  const now = new Date().toISOString();
  const details = parsed.data.status === "confirmed" && detailsResult.success ? detailsResult.data : null;
  const update = await db.from("invitations").update({
    rsvp_status: parsed.data.status,
    number_confirmed: confirmed,
    rsvp_source: "website",
    rsvp_updated_at: now,
    rsvp_note: parsed.data.note || null,
    rsvp_details: details,
    updated_at: now,
  }).eq("id", invitation.id);
  if (update.error) {
    console.error("RSVP invitation update failed", update.error);
    await recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.display_name, eventType: "rsvp_failed", target: "save_error" });
    redirect(resultUrl(parsed.data.token, "error"));
  }
  await recordInvitationActivity({ invitationId: invitation.id, displayName: invitation.display_name, eventType: "rsvp_saved", target: parsed.data.status, details: { numberConfirmed: confirmed } });
  const history = await db.from("rsvp_responses").insert({
    invitation_id: invitation.id,
    status: parsed.data.status,
    number_confirmed: confirmed,
    source: "website",
    note: parsed.data.note || null,
    details,
  });
  if (history.error) console.error("RSVP history insert failed", history.error);
  if (process.env.GOOGLE_SHEETS_WRITEBACK_ENABLED === "true" && invitation.source_row_id) {
    after(async () => {
      try {
        await writeSyncedInvitationRsvp({
          sourceRowId: invitation.source_row_id!,
          status: parsed.data.status,
          numberConfirmed: confirmed,
        });
      } catch (writebackError) {
        console.error("Google Sheets RSVP write-back failed", writebackError);
      }
    });
  }
  await createGuestSession(invitation.id);
  redirect(resultUrl(parsed.data.token, "success"));
}
