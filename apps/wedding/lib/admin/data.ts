import "server-only";

import { requireAdmin } from "./auth";
import { createAdminDataClient } from "./service-client";
import type { AdminInvitation, AdminOverview, AdminPhoto, AdminTable } from "./types";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import type { RsvpStatus } from "@/lib/types";

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

export async function listAdminInvitations(options: { search?: string; status?: string } = {}): Promise<AdminInvitation[]> {
  await requireAdmin();
  const db = createAdminDataClient();
  let query = db
    .from("invitations")
    .select(
      "id, display_name, normalized_phone, number_invited, number_confirmed, rsvp_status, table_number, guest_group, source_row_id, missing_from_source, secure_token, updated_at",
    )
    .order("display_name")
    .limit(200);
  if (options.status && ["pending", "confirmed", "declined", "maybe"].includes(options.status)) {
    query = query.eq("rsvp_status", options.status as RsvpStatus);
  }
  if (options.search?.trim()) {
    const safe = options.search.trim().replace(/[,%()]/g, "");
    query = query.or(`display_name.ilike.%${safe}%,normalized_phone.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  throwOnError(error);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name),
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
