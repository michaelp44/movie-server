import "server-only";

import { requireAdmin } from "./auth";
import { createAdminDataClient } from "./service-client";
import type { AdminInvitation, AdminLiveWallItem, AdminOverview, AdminPhoto, AdminRsvpInvitation, AdminTable } from "./types";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import type { RsvpStatus } from "@/lib/types";
import { parseRsvpDetails } from "@/lib/rsvp/details";
import { dietaryOptions } from "@/lib/rsvp/details";

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const db = createAdminDataClient();
  const [invitationResult, photoResult, guestbookResult, songResult] = await Promise.all([
    db.from("invitations").select("number_invited, number_confirmed, rsvp_status, table_number"),
    db.from("photo_uploads").select("id", { count: "exact", head: true }),
    db.from("guestbook_messages").select("id", { count: "exact", head: true }),
    db.from("song_requests").select("id", { count: "exact", head: true }),
  ]);
  throwOnError(invitationResult.error);
  throwOnError(photoResult.error);
  throwOnError(guestbookResult.error);
  throwOnError(songResult.error);
  const invitations = invitationResult.data ?? [];
  return {
    totalInvitations: invitations.length,
    totalInvited: invitations.reduce((sum, row) => sum + Number(row.number_invited ?? 0), 0),
    confirmed: invitations.reduce((sum, row) => sum + Number(row.number_confirmed ?? 0), 0),
    declined: invitations.filter((row) => row.rsvp_status === "declined").length,
    pending: invitations.filter((row) => row.rsvp_status === "pending").length,
    tablesAssigned: invitations.filter((row) => row.table_number).length,
    photos: photoResult.count ?? 0,
    guestbook: guestbookResult.count ?? 0,
    songs: songResult.count ?? 0,
  };
}

export async function getAdminDietaryTotals(): Promise<Array<{ label: string; count: number }>> {
  await requireAdmin();
  const db = createAdminDataClient();
  const { data, error } = await db.from("invitations")
    .select("number_confirmed, rsvp_details")
    .eq("rsvp_status", "confirmed")
    .limit(1000);
  throwOnError(error);
  const totals = new Map(dietaryOptions.map(([key, label]) => [key, { label, count: 0 }]));
  for (const row of data ?? []) {
    const details = parseRsvpDetails(row.rsvp_details);
    if (!details) continue;
    for (const [key] of dietaryOptions) {
      if (!details.dietary.includes(key)) continue;
      const category = totals.get(key)!;
      // Older RSVP records contain the selected category but not a per-category count.
      category.count += details.dietaryCounts?.[key] ?? Number(row.number_confirmed ?? 0);
    }
  }
  return [...totals.values()];
}

export async function listAdminInvitations(options: { search?: string; status?: string } = {}): Promise<AdminInvitation[]> {
  await requireAdmin();
  const db = createAdminDataClient();
  let query = db
    .from("invitations")
    .select(
      "id, display_name, primary_phone, normalized_phone, number_invited, number_confirmed, rsvp_status, table_number, guest_group, source_row_id, missing_from_source, secure_token, updated_at",
    )
    .order("display_name")
    .limit(200);
  if (options.status && ["pending", "confirmed", "declined", "maybe"].includes(options.status)) {
    query = query.eq("rsvp_status", options.status as RsvpStatus);
  }
  if (options.search?.trim()) {
    const safe = options.search.trim().replace(/[,%()]/g, "");
    query = query.or(`display_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%,normalized_phone.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  throwOnError(error);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name),
    primaryPhone: row.primary_phone ? String(row.primary_phone) : null,
    normalizedPhone: row.normalized_phone ? String(row.normalized_phone) : null,
    numberInvited: Number(row.number_invited),
    numberConfirmed: Number(row.number_confirmed),
    rsvpStatus: String(row.rsvp_status),
    tableNumber: row.table_number ? String(row.table_number) : null,
    guestGroup: row.guest_group ? String(row.guest_group) : null,
    sourceRowId: row.source_row_id ? String(row.source_row_id) : null,
    missingFromSource: Boolean(row.missing_from_source),
    secureToken: String(row.secure_token ?? ""),
    updatedAt: String(row.updated_at),
  }));
}

export async function getAdminInvitation(id: string): Promise<AdminInvitation | null> {
  const rows = await listAdminInvitations();
  return rows.find((row) => row.id === id) ?? null;
}

export async function listAdminRsvpInvitations(options: { search?: string; status?: string; contact?: string } = {}): Promise<AdminRsvpInvitation[]> {
  await requireAdmin();
  const db = createAdminDataClient();
  let query = db
    .from("invitations")
    .select("id, display_name, primary_phone, normalized_phone, number_invited, number_confirmed, rsvp_status, rsvp_source, rsvp_updated_at, rsvp_note, rsvp_details, contact_opt_out, checked_in_at, table_number, guest_group, source_row_id, missing_from_source, secure_token, updated_at")
    .order("display_name")
    .limit(500);
  if (options.status && ["pending", "confirmed", "declined", "maybe"].includes(options.status)) {
    query = query.eq("rsvp_status", options.status as RsvpStatus);
  }
  if (options.search?.trim()) {
    const safe = options.search.trim().replace(/[,%()]/g, "");
    query = query.or(`display_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%,normalized_phone.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  throwOnError(error);
  const rows = data ?? [];
  const ids = rows.map((row) => String(row.id));
  const [deliveryResult, responseResult, callResult] = ids.length
    ? await Promise.all([
        db.from("message_deliveries").select("id, invitation_id, message_kind, status, created_at, sent_at, error_message").in("invitation_id", ids).order("created_at", { ascending: false }),
        db.from("rsvp_responses").select("id, invitation_id, status, number_confirmed, source, note, details, created_at").in("invitation_id", ids).order("created_at", { ascending: false }),
        db.from("call_attempts").select("invitation_id, outcome, note, created_at").in("invitation_id", ids).order("created_at", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  throwOnError(deliveryResult.error);
  throwOnError(responseResult.error);
  throwOnError(callResult.error);
  const latest = new Map<string, NonNullable<typeof deliveryResult.data>[number]>();
  for (const delivery of deliveryResult.data ?? []) {
    if (!latest.has(delivery.invitation_id)) latest.set(delivery.invitation_id, delivery);
  }
  const history = new Map<string, Array<NonNullable<typeof responseResult.data>[number]>>();
  for (const response of responseResult.data ?? []) {
    const invitationHistory = history.get(response.invitation_id) ?? [];
    if (invitationHistory.length < 5) invitationHistory.push(response);
    history.set(response.invitation_id, invitationHistory);
  }
  const latestCall = new Map<string, NonNullable<typeof callResult.data>[number]>();
  for (const call of callResult.data ?? []) if (!latestCall.has(call.invitation_id)) latestCall.set(call.invitation_id, call);
  const mapped = rows.map((row) => {
    const delivery = latest.get(String(row.id));
    return {
      id: String(row.id),
      displayName: String(row.display_name),
      primaryPhone: row.primary_phone ? String(row.primary_phone) : null,
      normalizedPhone: row.normalized_phone ? String(row.normalized_phone) : null,
      numberInvited: Number(row.number_invited),
      numberConfirmed: Number(row.number_confirmed),
      rsvpStatus: String(row.rsvp_status),
      tableNumber: row.table_number ? String(row.table_number) : null,
      guestGroup: row.guest_group ? String(row.guest_group) : null,
      sourceRowId: row.source_row_id ? String(row.source_row_id) : null,
      missingFromSource: Boolean(row.missing_from_source),
      secureToken: String(row.secure_token),
      updatedAt: String(row.updated_at),
      rsvpSource: row.rsvp_source,
      rsvpUpdatedAt: row.rsvp_updated_at,
      rsvpNote: row.rsvp_note,
      rsvpDetails: parseRsvpDetails(row.rsvp_details),
      contactOptOut: row.contact_opt_out,
      checkedInAt: row.checked_in_at,
      responseHistory: (history.get(String(row.id)) ?? []).map((response) => ({
        id: response.id,
        status: response.status,
        numberConfirmed: response.number_confirmed,
        source: response.source,
        note: response.note,
        details: parseRsvpDetails(response.details),
        createdAt: response.created_at,
      })),
      lastCall: latestCall.has(String(row.id)) ? {
        outcome: latestCall.get(String(row.id))!.outcome,
        note: latestCall.get(String(row.id))!.note,
        createdAt: latestCall.get(String(row.id))!.created_at,
      } : null,
      lastDelivery: delivery ? {
        id: delivery.id,
        kind: delivery.message_kind,
        status: delivery.status,
        createdAt: delivery.created_at,
        sentAt: delivery.sent_at,
        errorMessage: delivery.error_message,
      } : null,
    };
  });
  if (options.contact === "unsent") return mapped.filter((item) => !item.lastDelivery);
  if (options.contact === "failed") return mapped.filter((item) => item.lastDelivery?.status === "failed");
  if (options.contact === "sent") return mapped.filter((item) => item.lastDelivery?.status === "sent");
  if (options.contact === "no-phone") return mapped.filter((item) => !item.normalizedPhone);
  return mapped;
}

export async function getAdminTables(): Promise<{ tables: AdminTable[]; unassigned: AdminInvitation[] }> {
  await requireAdmin();
  const db = createAdminDataClient();
  const [tablesResult, invitations] = await Promise.all([
    db.from("wedding_tables").select("id, table_number, name, capacity").order("sort_order").order("table_number"),
    listAdminInvitations(),
  ]);
  throwOnError(tablesResult.error);
  const tables = (tablesResult.data ?? []).map((row) => {
    const assigned = invitations.filter((invitation) => invitation.tableNumber === String(row.table_number));
    const assignedCount = assigned.reduce(
      (sum, invitation) => sum + (invitation.numberConfirmed || invitation.numberInvited),
      0,
    );
    return {
      id: String(row.id),
      tableNumber: String(row.table_number),
      name: row.name ? String(row.name) : null,
      capacity: row.capacity == null ? null : Number(row.capacity),
      invitations: assigned.map(({ id, displayName, numberInvited, numberConfirmed }) => ({
        id,
        displayName,
        numberInvited,
        numberConfirmed,
      })),
      assignedCount,
    };
  });
  return { tables, unassigned: invitations.filter((invitation) => !invitation.tableNumber) };
}

export async function listAdminPhotos(): Promise<AdminPhoto[]> {
  await requireAdmin();
  const db = createAdminDataClient();
  const { data, error } = await db
    .from("photo_uploads")
    .select("id, uploader_name, storage_path, mime_type, file_size, approved, rejected, created_at")
    .eq("upload_completed", true)
    .order("created_at", { ascending: false })
    .limit(200);
  throwOnError(error);
  const rows = data ?? [];
  const { data: signed } = rows.length
    ? await db.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrls(rows.map((row) => String(row.storage_path)), 3600)
    : { data: [] };
  return rows.map((row, index) => ({
    id: String(row.id),
    displayName: row.uploader_name ? String(row.uploader_name) : null,
    storagePath: String(row.storage_path),
    mimeType: String(row.mime_type),
    fileSize: Number(row.file_size),
    approved: Boolean(row.approved),
    rejected: Boolean(row.rejected),
    createdAt: String(row.created_at),
    previewUrl: signed?.[index]?.signedUrl ?? null,
  }));
}

export async function listLiveWallItems(): Promise<AdminLiveWallItem[]> {
  await requireAdmin();
  const db = createAdminDataClient();
  const [photoResult, blessingResult] = await Promise.all([
    db.from("photo_uploads").select("id, uploader_name, storage_path, message, moderation_status, moderation_reason, moderation_confidence, hidden_at, created_at").eq("upload_completed", true).order("created_at", { ascending: false }).limit(150),
    db.from("guestbook_messages").select("id, display_name, message, moderation_status, moderation_reason, moderation_confidence, hidden_at, created_at").order("created_at", { ascending: false }).limit(150),
  ]);
  throwOnError(photoResult.error);
  throwOnError(blessingResult.error);
  const photos = photoResult.data ?? [];
  const { data: signed } = photos.length ? await db.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrls(photos.map((row) => row.storage_path), 3600) : { data: [] };
  return [
    ...photos.map((row, index): AdminLiveWallItem => ({ id: row.id, kind: "photo", displayName: row.uploader_name, message: row.message, previewUrl: signed?.[index]?.signedUrl ?? null, status: row.moderation_status, reason: row.moderation_reason, confidence: row.moderation_confidence, hiddenAt: row.hidden_at, createdAt: row.created_at })),
    ...(blessingResult.data ?? []).map((row): AdminLiveWallItem => ({ id: row.id, kind: "blessing", displayName: row.display_name, message: row.message, previewUrl: null, status: row.moderation_status, reason: row.moderation_reason, confidence: row.moderation_confidence, hiddenAt: row.hidden_at, createdAt: row.created_at })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listGuestbookMessages() {
  await requireAdmin();
  const db = createAdminDataClient();
  const { data, error } = await db
    .from("guestbook_messages")
    .select("id, display_name, message, approved, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  throwOnError(error);
  return data ?? [];
}

export async function listSongRequests(search?: string) {
  await requireAdmin();
  const db = createAdminDataClient();
  let query = db
    .from("song_requests")
    .select("id, display_name, song, artist, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (search?.trim()) {
    const safe = search.trim().replace(/[,%()]/g, "");
    query = query.or(`song.ilike.%${safe}%,artist.ilike.%${safe}%,display_name.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  throwOnError(error);
  return data ?? [];
}

export async function getSiteSettings(): Promise<Record<string, unknown>> {
  await requireAdmin();
  const db = createAdminDataClient();
  const { data, error } = await db.from("site_settings").select("key, value");
  throwOnError(error);
  return Object.fromEntries((data ?? []).map((row) => [String(row.key), row.value]));
}

export async function getRecentSyncRuns() {
  await requireAdmin();
  const db = createAdminDataClient();
  const { data, error } = await db
    .from("sync_runs")
    .select("id, mode, status, addition_count, update_count, error_count, error, started_at, completed_at")
    .order("started_at", { ascending: false })
    .limit(20);
  throwOnError(error);
  return data ?? [];
}
