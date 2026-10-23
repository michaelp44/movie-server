"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminDataClient, requireAdmin } from "@/lib/admin";
import { fallbackRequest, isFallbackConfigured } from "@/lib/fallback/client";
import { normalizeSheetPhone, verifyGoogleSheetsWriteAccess, writeSyncedInvitationRsvp } from "@/lib/google-sheets";
import { synchronizeWeddingGuests } from "@/lib/sync";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import { parseTableNumber } from "@/lib/table";
import { weddingMessage, weddingMessageMediaUrl, whatsappRecipient } from "@/lib/rsvp/messages";
import { campaignCandidates, parseCampaignGroupSelection } from "@/lib/rsvp/campaign-queue";

function withNotice(path: string, notice: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}`);
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const invitationSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    displayName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30),
    numberInvited: z.coerce.number().int().min(1).max(30),
    numberConfirmed: z.coerce.number().int().min(0),
    rsvpStatus: z.enum(["pending", "confirmed", "declined", "maybe"]),
    tableNumber: z.string().trim().max(30).optional(),
    guestGroup: z.string().trim().max(80).optional(),
  });

export async function saveInvitationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = invitationSchema.safeParse({
    id: formData.get("id") ?? "",
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    numberInvited: formData.get("numberInvited"),
    numberConfirmed: formData.get("numberConfirmed"),
    rsvpStatus: formData.get("rsvpStatus"),
    tableNumber: formData.get("tableNumber"),
    guestGroup: formData.get("guestGroup"),
  });
  if (!parsed.success) withNotice("/admin/guests", parsed.error.issues[0]?.message ?? "הפרטים אינם תקינים.");
  const normalizedPhone = parsed.data.phone ? normalizeSheetPhone(parsed.data.phone) : null;
  if (parsed.data.phone && !normalizedPhone) withNotice("/admin/guests", "מספר הטלפון אינו מספר ישראלי תקין.");
  const tableNumber = parsed.data.tableNumber ? parseTableNumber(parsed.data.tableNumber) : null;
  if (parsed.data.tableNumber && !tableNumber) withNotice("/admin/guests", "מספר השולחן חייב להיות בין 1 ל-999.");

  const db = createAdminDataClient();
  const currentRsvp = parsed.data.id
    ? await db.from("invitations").select("rsvp_status, number_confirmed").eq("id", parsed.data.id).maybeSingle()
    : null;
  if (currentRsvp) assertNoError(currentRsvp.error);
  const rsvpChanged = Boolean(currentRsvp?.data && (
    currentRsvp.data.rsvp_status !== parsed.data.rsvpStatus
    || currentRsvp.data.number_confirmed !== parsed.data.numberConfirmed
  ));
  if (tableNumber) {
    const tableResult = await db.from("wedding_tables").upsert(
      { table_number: tableNumber },
      { onConflict: "table_number", ignoreDuplicates: true },
    );
    assertNoError(tableResult.error);
  }
  const values = {
    display_name: parsed.data.displayName,
    primary_phone: parsed.data.phone || null,
    normalized_phone: normalizedPhone,
    number_invited: parsed.data.numberInvited,
    number_confirmed: parsed.data.numberConfirmed,
    rsvp_status: parsed.data.rsvpStatus,
    table_number: tableNumber,
    guest_group: parsed.data.guestGroup || null,
    updated_at: new Date().toISOString(),
    ...(rsvpChanged ? { rsvp_source: "admin" as const, rsvp_updated_at: new Date().toISOString() } : {}),
  };
  const result = parsed.data.id
    ? await db.from("invitations").update(values).eq("id", parsed.data.id)
    : await db.from("invitations").insert({
        ...values,
        secure_token: randomBytes(32).toString("base64url"),
        source_row_id: null,
        missing_from_source: false,
      });
  assertNoError(result.error);
  if (parsed.data.id && rsvpChanged) {
    assertNoError((await db.from("rsvp_responses").insert({
      invitation_id: parsed.data.id,
      status: parsed.data.rsvpStatus,
      number_confirmed: parsed.data.numberConfirmed,
      source: "admin",
    })).error);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/guests");
  withNotice("/admin/guests", parsed.data.id ? "ההזמנה עודכנה." : "ההזמנה נוספה.");
}

const tableSchema = z.object({
  tableNumber: z.string().trim().min(1).max(30),
  name: z.string().trim().max(80).optional(),
  capacity: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]),
});

export async function saveTableAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = tableSchema.safeParse({
    tableNumber: formData.get("tableNumber"),
    name: formData.get("name"),
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) withNotice("/admin/tables", "פרטי השולחן אינם תקינים.");
  const tableNumber = parseTableNumber(parsed.data.tableNumber);
  if (!tableNumber) withNotice("/admin/tables", "מספר השולחן חייב להיות בין 1 ל-999.");
  const db = createAdminDataClient();
  const { error } = await db.from("wedding_tables").upsert(
    {
      table_number: tableNumber,
      name: parsed.data.name || null,
      capacity: parsed.data.capacity === "" ? null : parsed.data.capacity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "table_number" },
  );
  assertNoError(error);
  revalidatePath("/admin/tables");
  withNotice("/admin/tables", "השולחן נשמר.");
}

export async function setSiteFlagAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!["seating_published", "gallery_published", "live_wall_ai_art"].includes(key)) throw new Error("Invalid setting key.");
  const enabled = formData.get("enabled") === "true";
  const db = createAdminDataClient();
  const { error } = await db
    .from("site_settings")
    .upsert({ key, value: enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });
  assertNoError(error);
  if (isFallbackConfigured()) await fallbackRequest("/v1/settings", { method: "POST", body: { key, value: enabled } }).catch((mirrorError) => console.error("Fallback setting mirror failed", mirrorError));
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  withNotice("/admin/settings", enabled ? "הפרסום הופעל." : "הפרסום הושהה.");
}

export async function moderatePhotoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const decision = z.enum(["approve", "reject"]).parse(formData.get("decision"));
  const db = createAdminDataClient();
  const { error } = await db
    .from("photo_uploads")
    .update({
      approved: decision === "approve",
      rejected: decision === "reject",
      moderated_at: new Date().toISOString(),
      moderated_by: admin.id,
    })
    .eq("id", id);
  assertNoError(error);
  if (isFallbackConfigured()) await fallbackRequest("/v1/moderation", { method: "POST", body: { id, action: decision === "approve" ? "approve" : "block" } }).catch((mirrorError) => console.error("Fallback photo moderation mirror failed", mirrorError));
  revalidatePath("/admin/photos");
  revalidatePath("/photos");
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = createAdminDataClient();
  const { data, error } = await db.from("photo_uploads").select("storage_path").eq("id", id).single();
  assertNoError(error);
  const storageResult = await db.storage.from(WEDDING_MEDIA_BUCKET).remove([String(data?.storage_path)]);
  assertNoError(storageResult.error);
  const deleteResult = await db.from("photo_uploads").delete().eq("id", id);
  assertNoError(deleteResult.error);
  if (isFallbackConfigured()) await fallbackRequest("/v1/moderation", { method: "POST", body: { id, action: "delete" } }).catch((mirrorError) => console.error("Fallback photo deletion mirror failed", mirrorError));
  revalidatePath("/admin/photos");
  revalidatePath("/photos");
}

export async function moderateGuestbookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const approved = formData.get("approved") === "true";
  const db = createAdminDataClient();
  const { error } = await db.from("guestbook_messages").update({
    approved,
    rejected: !approved,
    moderated_at: new Date().toISOString(),
    moderated_by: admin.id,
  }).eq("id", id);
  assertNoError(error);
  if (isFallbackConfigured()) await fallbackRequest("/v1/moderation", { method: "POST", body: { id, action: approved ? "approve" : "block" } }).catch((mirrorError) => console.error("Fallback blessing moderation mirror failed", mirrorError));
  revalidatePath("/admin/guestbook");
}

export async function deleteSongRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = createAdminDataClient();
  const { error } = await db.from("song_requests").delete().eq("id", id);
  assertNoError(error);
  revalidatePath("/admin/songs");
}

export async function runGuestSyncAction(formData: FormData): Promise<void> {
  await requireAdmin();
  if (formData.get("confirmation") !== "apply") throw new Error("A preview confirmation is required.");
  let report;
  try {
    ({ report } = await synchronizeWeddingGuests());
  } catch (error) {
    console.error("Google Sheets synchronization failed", error);
    withNotice("/admin/sync", "לא הצלחנו לקרוא או לסנכרן את הגיליון. בדקו את החיבור וההרשאות ונסו שוב.");
  }
  revalidatePath("/admin", "layout");
  withNotice(
    "/admin/sync",
    `${report.processed} הזמנות עובדו · ${report.added} חדשות · ${report.updated} עודכנו · ${report.errors} שגיאות`,
  );
}

export async function verifyGoogleSheetsWriteAccessAction(): Promise<void> {
  await requireAdmin();
  try {
    await verifyGoogleSheetsWriteAccess();
  } catch (error) {
    console.error("Google Sheets write-access check failed", error);
    withNotice("/admin/sync", "אין עדיין הרשאת כתיבה לגיליון. יש לשתף אותו עם ה-service account בתפקיד Editor.");
  }
  withNotice("/admin/sync", "הרשאת הכתיבה ל-Google Sheets תקינה. הבדיקה לא שינתה אף תא.");
}

export async function verifyGoogleSheetsWritebackAction(): Promise<void> {
  await requireAdmin();
  const db = createAdminDataClient();
  const { data: invitation, error } = await db
    .from("invitations")
    .select("display_name, source_row_id, rsvp_status, number_confirmed")
    .not("source_row_id", "is", null)
    .is("rsvp_source", null)
    .order("source_row_id")
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  if (!invitation?.source_row_id) {
    withNotice("/admin/sync", "לא נמצאה הזמנה מסונכרנת בטוחה לבדיקת כתיבה.");
  }
  try {
    await writeSyncedInvitationRsvp({
      sourceRowId: invitation.source_row_id,
      status: invitation.rsvp_status,
      numberConfirmed: invitation.number_confirmed,
    });
  } catch (writebackError) {
    console.error("Google Sheets bounded RSVP write-back check failed", writebackError);
    withNotice("/admin/sync", "בדיקת הכתיבה המוגבלת נכשלה. המנגנון נשאר כבוי.");
  }
  withNotice("/admin/sync", `בדיקת הכתיבה המוגבלת הצליחה עבור ${invitation.display_name}; אותם ערכים נכתבו מחדש ללא שינוי בתשובה.`);
}

export async function rotateInvitationTokenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = createAdminDataClient();
  const { error } = await db
    .from("invitations")
    .update({ secure_token: randomBytes(32).toString("base64url"), updated_at: new Date().toISOString() })
    .eq("id", id);
  assertNoError(error);
  revalidatePath("/admin/qr");
  withNotice("/admin/qr", "הקישור האישי הוחלף. הקישור הישן אינו פעיל עוד.");
}

export async function moderateLiveWallAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const kind = z.enum(["photo", "blessing"]).parse(formData.get("kind"));
  const action = z.enum(["approve", "block", "hide", "restore", "delete"]).parse(formData.get("moderationAction"));
  const db = createAdminDataClient();

  if (action === "delete") {
    if (kind === "photo") {
      const { data, error } = await db.from("photo_uploads").select("storage_path").eq("id", id).single();
      assertNoError(error);
      if (data?.storage_path) assertNoError((await db.storage.from(WEDDING_MEDIA_BUCKET).remove([data.storage_path])).error);
      assertNoError((await db.from("photo_uploads").delete().eq("id", id)).error);
    } else {
      assertNoError((await db.from("guestbook_messages").delete().eq("id", id)).error);
    }
  } else {
    const now = new Date().toISOString();
    const values = action === "hide" ? { hidden_at: now }
      : action === "restore" ? { hidden_at: null }
      : {
          moderation_status: action === "approve" ? "APPROVED" as const : "BLOCKED" as const,
          approved: action === "approve",
          rejected: action === "block",
          approved_at: action === "approve" ? now : null,
          moderated_at: now,
          moderated_by: admin.id,
          hidden_at: action === "approve" ? null : undefined,
        };
    const result = kind === "photo"
      ? await db.from("photo_uploads").update(values).eq("id", id)
      : await db.from("guestbook_messages").update(values).eq("id", id);
    assertNoError(result.error);
  }
  if (isFallbackConfigured()) await fallbackRequest("/v1/moderation", { method: "POST", body: { id, action } }).catch((mirrorError) => console.error("Fallback Live Wall moderation mirror failed", mirrorError));
  revalidatePath("/admin/live-wall");
  revalidatePath("/admin/guestbook");
  revalidatePath("/live");
}

export async function setLiveWallControlAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = z.enum(["live_wall_enabled", "live_wall_paused", "live_wall_blank"]).parse(formData.get("key"));
  const value = formData.get("value") === "true";
  const db = createAdminDataClient();
  assertNoError((await db.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })).error);
  if (isFallbackConfigured()) await fallbackRequest("/v1/settings", { method: "POST", body: { key, value } }).catch((mirrorError) => console.error("Fallback Live Wall setting mirror failed", mirrorError));
  revalidatePath("/admin/live-wall");
}

const whatsappSendSchema = z.object({
  invitationId: z.string().uuid(),
  messageKind: z.enum(["invitation", "reminder", "event_details", "table_assignment", "thank_you"]),
  returnTo: z.enum(["/admin/rsvp", "/admin/rsvp?contact=unsent"]).default("/admin/rsvp"),
});

export async function sendWeddingWhatsappAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = whatsappSendSchema.safeParse({
    invitationId: formData.get("invitationId"),
    messageKind: formData.get("messageKind"),
    returnTo: formData.get("returnTo") || "/admin/rsvp",
  });
  if (!parsed.success) withNotice("/admin/rsvp", "בקשת השליחה אינה תקינה.");
  const noticePath = parsed.data.returnTo;
  if (!isFallbackConfigured()) withNotice(noticePath, "שירות השליחה המקומי אינו מוגדר.");

  const db = createAdminDataClient();
  const { data: invitation, error } = await db.from("invitations")
    .select("id, display_name, normalized_phone, secure_token, table_number")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();
  assertNoError(error);
  if (!invitation) withNotice(noticePath, "ההזמנה לא נמצאה.");
  const { data: contactState } = await db.from("invitations").select("contact_opt_out").eq("id", invitation.id).single();
  if (contactState?.contact_opt_out) withNotice(noticePath, "ההזמנה מסומנת כ'לא ליצור קשר'.");
  const recipient = invitation.normalized_phone ? whatsappRecipient(invitation.normalized_phone) : null;
  if (!recipient) withNotice(noticePath, "להזמנה הזו אין מספר ישראלי תקין.");

  const messageBody = weddingMessage({
    kind: parsed.data.messageKind,
    displayName: invitation.display_name,
    secureToken: invitation.secure_token,
    tableNumber: invitation.table_number,
  });
  const recentCutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: recentDelivery, error: recentError } = await db.from("message_deliveries")
    .select("id")
    .eq("invitation_id", invitation.id)
    .eq("message_kind", parsed.data.messageKind)
    .in("status", ["pending", "sent"])
    .gte("requested_at", recentCutoff)
    .limit(1)
    .maybeSingle();
  assertNoError(recentError);
  if (recentDelivery) withNotice(noticePath, "הודעה זהה כבר נשלחה או נמצאת בתהליך. המתינו שתי דקות לפני ניסיון נוסף.");
  const deliveryId = randomUUID();
  const created = await db.from("message_deliveries").insert({
    id: deliveryId,
    invitation_id: invitation.id,
    channel: "whatsapp_web",
    message_kind: parsed.data.messageKind,
    status: "pending",
    message_body: messageBody,
    requested_by: admin.id,
  });
  assertNoError(created.error);

  try {
    const result = await fallbackRequest<{ messageId: string }>("/v1/whatsapp/send", {
      method: "POST",
      timeoutMs: 20_000,
      body: { operationId: deliveryId, recipient, message: messageBody, mediaUrl: weddingMessageMediaUrl(parsed.data.messageKind) },
    });
    const now = new Date().toISOString();
    assertNoError((await db.from("message_deliveries").update({
      status: "sent",
      provider_message_id: result.messageId,
      sent_at: now,
      updated_at: now,
    }).eq("id", deliveryId)).error);
  } catch (sendError) {
    console.error("Supervised WhatsApp send failed", sendError);
    const now = new Date().toISOString();
    await db.from("message_deliveries").update({
      status: "failed",
      error_code: "LOCAL_AGENT_UNAVAILABLE",
      error_message: "החיבור המקומי ל-WhatsApp אינו זמין.",
      failed_at: now,
      updated_at: now,
    }).eq("id", deliveryId);
    revalidatePath("/admin/rsvp");
    withNotice(noticePath, "ההודעה לא נשלחה. בדקו שסוכן WhatsApp מחובר ונסו שוב.");
  }
  revalidatePath("/admin/rsvp");
  withNotice(noticePath, `ההודעה נשלחה אל ${invitation.display_name}. עוברים להזמנה הבאה.`);
}

export async function setContactOptOutAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("invitationId"));
  const enabled = formData.get("enabled") === "true";
  const db = createAdminDataClient();
  assertNoError((await db.from("invitations").update({ contact_opt_out: enabled, updated_at: new Date().toISOString() }).eq("id", id)).error);
  revalidatePath("/admin/rsvp");
  withNotice("/admin/rsvp", enabled ? "ההזמנה סומנה כ'לא ליצור קשר'." : "ניתן ליצור קשר עם ההזמנה שוב.");
}

const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  messageKind: z.enum(["invitation", "reminder", "event_details", "table_assignment", "thank_you"]),
  audience: z.enum(["all_contactable", "pending_rsvp", "confirmed", "declined"]),
  guestGroupSelection: z.string().trim().max(200),
  minDelaySeconds: z.coerce.number().int().min(30).max(900),
  maxDelaySeconds: z.coerce.number().int().min(30).max(1800),
  confirmation: z.literal("queue"),
}).refine((value) => value.maxDelaySeconds >= value.minDelaySeconds, { message: "טווח ההשהיה אינו תקין." });

export async function createWhatsappCampaignAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"), messageKind: formData.get("messageKind"), audience: formData.get("audience"),
    guestGroupSelection: formData.get("guestGroupSelection"),
    minDelaySeconds: formData.get("minDelaySeconds"), maxDelaySeconds: formData.get("maxDelaySeconds"), confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) withNotice("/admin/rsvp/campaigns", parsed.error.issues[0]?.message ?? "פרטי הקמפיין אינם תקינים.");
  const groupSelection = parseCampaignGroupSelection(parsed.data.guestGroupSelection);
  if (!groupSelection) withNotice("/admin/rsvp/campaigns", "צריך לבחור קבוצה וצד תקינים.");
  const { groupFilter: guestGroupFilter, sideFilter: guestSideFilter } = groupSelection;
  const candidates = await campaignCandidates(parsed.data.audience, parsed.data.messageKind, guestGroupFilter, guestSideFilter);
  if (!candidates.length) withNotice("/admin/rsvp/campaigns", "לא נמצאו נמענים מתאימים שלא קיבלו כבר את ההודעה הזו.");
  const db = createAdminDataClient();
  const now = new Date().toISOString();
  const created = await db.from("message_campaigns").insert({
    name: parsed.data.name, message_kind: parsed.data.messageKind, audience: parsed.data.audience, guest_group_filter: guestGroupFilter, guest_side_filter: guestSideFilter, status: "queued",
    min_delay_seconds: parsed.data.minDelaySeconds, max_delay_seconds: parsed.data.maxDelaySeconds,
    scheduled_for: now, next_run_at: now, created_by: admin.id,
  }).select("id").single();
  assertNoError(created.error);
  const recipients = candidates.map((candidate) => ({ campaign_id: created.data!.id, invitation_id: candidate.id }));
  assertNoError((await db.from("message_campaign_recipients").insert(recipients)).error);
  revalidatePath("/admin/rsvp/campaigns");
  withNotice("/admin/rsvp/campaigns", `הקמפיין נוסף לתור עם ${recipients.length} נמענים. ניתן לעצור אותו בכל רגע.`);
}

export async function setWhatsappCampaignStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("campaignId"));
  const status = z.enum(["queued", "paused", "cancelled"]).parse(formData.get("status"));
  const now = new Date().toISOString();
  const db = createAdminDataClient();
  assertNoError((await db.from("message_campaigns").update({ status, next_run_at: status === "queued" ? now : null, updated_at: now }).eq("id", id).in("status", ["queued", "running", "paused"])).error);
  revalidatePath("/admin/rsvp/campaigns");
  withNotice("/admin/rsvp/campaigns", status === "paused" ? "הקמפיין הושהה." : status === "cancelled" ? "הקמפיין בוטל." : "הקמפיין חודש.");
}

const callResultSchema = z.object({
  invitationId: z.string().uuid(),
  nextInvitationId: z.string().uuid().optional().or(z.literal("")),
  outcome: z.enum(["no_answer", "confirmed", "declined", "callback", "wrong_number"]),
  numberConfirmed: z.coerce.number().int().min(0),
  note: z.string().trim().max(500).optional(),
}).refine((value) => value.outcome !== "confirmed" || value.numberConfirmed > 0, { message: "Confirmed attendance requires at least one guest." });

export async function saveCallResultAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = callResultSchema.safeParse({ invitationId: formData.get("invitationId"), nextInvitationId: formData.get("nextInvitationId") ?? "", outcome: formData.get("outcome"), numberConfirmed: formData.get("numberConfirmed"), note: formData.get("note") });
  if (!parsed.success) withNotice("/admin/rsvp/calls", "תוצאת השיחה אינה תקינה.");
  const db = createAdminDataClient();
  const { data: invitation, error } = await db.from("invitations").select("source_row_id").eq("id", parsed.data.invitationId).single();
  assertNoError(error);
  if (!invitation) withNotice("/admin/rsvp/calls", "ההזמנה לא נמצאה.");
  assertNoError((await db.from("call_attempts").insert({
    invitation_id: parsed.data.invitationId,
    outcome: parsed.data.outcome,
    number_confirmed: parsed.data.numberConfirmed,
    note: parsed.data.note || null,
    created_by: admin.id,
  })).error);
  if (parsed.data.outcome === "wrong_number") {
    assertNoError((await db.from("invitations").update({ contact_opt_out: true, updated_at: new Date().toISOString() }).eq("id", parsed.data.invitationId)).error);
  }
  if (parsed.data.outcome === "confirmed" || parsed.data.outcome === "declined") {
    const status = parsed.data.outcome;
    const confirmed = status === "declined" ? 0 : parsed.data.numberConfirmed;
    const now = new Date().toISOString();
    assertNoError((await db.from("invitations").update({ rsvp_status: status, number_confirmed: confirmed, rsvp_source: "phone", rsvp_updated_at: now, rsvp_note: parsed.data.note || null, updated_at: now }).eq("id", parsed.data.invitationId)).error);
    assertNoError((await db.from("rsvp_responses").insert({ invitation_id: parsed.data.invitationId, status, number_confirmed: confirmed, source: "phone", note: parsed.data.note || null })).error);
    if (process.env.GOOGLE_SHEETS_WRITEBACK_ENABLED === "true" && invitation.source_row_id) {
      try {
        await writeSyncedInvitationRsvp({ sourceRowId: invitation.source_row_id, status, numberConfirmed: confirmed });
      } catch (writebackError) {
        console.error("Phone RSVP Google Sheets write-back failed", writebackError);
      }
    }
  }
  revalidatePath("/admin/rsvp/calls");
  revalidatePath("/admin/rsvp");
  const nextPath = parsed.data.nextInvitationId ? `/admin/rsvp/calls?current=${parsed.data.nextInvitationId}` : "/admin/rsvp/calls";
  withNotice(nextPath, "תוצאת השיחה נשמרה. עוברים לאורח הבא.");
}

export async function toggleCheckInAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("invitationId"));
  const checkedIn = formData.get("checkedIn") === "true";
  const db = createAdminDataClient();
  assertNoError((await db.from("invitations").update({ checked_in_at: checkedIn ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id)).error);
  revalidatePath("/admin/check-in");
}
