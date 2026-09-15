import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import { storedUploadMatches } from "@/lib/upload/validation";
import { decisionToStatus, moderateWeddingContent } from "@/lib/moderation";

export type ApprovedMedia = {
  id: string;
  kind: "image" | "video";
  url: string;
  alt: string;
  createdAt: string;
};

export async function saveGuestbookMessage(input: {
  invitationId: string | null;
  displayName: string;
  message: string;
}) {
  const supabase = createAdminClient();
  let duplicateQuery = supabase
    .from("guestbook_messages")
    .select("moderation_status")
    .eq("message", input.message)
    .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(1);
  duplicateQuery = input.invitationId
    ? duplicateQuery.eq("invitation_id", input.invitationId)
    : duplicateQuery.is("invitation_id", null).eq("display_name", input.displayName);
  const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) return duplicate.moderation_status;

  const { data, error } = await supabase.from("guestbook_messages").insert({
    invitation_id: input.invitationId,
    display_name: input.displayName,
    message: input.message,
    approved: false,
    moderation_status: "PENDING",
  }).select("id").single();
  if (error) throw error;
  const result = await moderateWeddingContent({ text: input.message });
  const status = decisionToStatus(result.decision);
  const now = new Date().toISOString();
  const { error: moderationError } = await supabase.from("guestbook_messages").update({
    moderation_status: status,
    moderation_reason: result.reason,
    moderation_categories: result.categories,
    moderation_confidence: result.confidence,
    approved: status === "APPROVED",
    rejected: status === "BLOCKED",
    approved_at: status === "APPROVED" ? now : null,
    moderated_at: now,
  }).eq("id", data.id);
  if (moderationError) throw moderationError;
  return status;
}

export async function saveSongRequest(input: {
  invitationId: string | null;
  displayName: string;
  song: string;
  artist: string;
}) {
  const supabase = createAdminClient();
  let duplicateQuery = supabase
    .from("song_requests")
    .select("id")
    .ilike("song", input.song)
    .ilike("artist", input.artist)
    .limit(1);
  duplicateQuery = input.invitationId
    ? duplicateQuery.eq("invitation_id", input.invitationId)
    : duplicateQuery.is("invitation_id", null).ilike("display_name", input.displayName);
  const { data: existing, error: lookupError } = await duplicateQuery;

  if (lookupError) throw lookupError;
  if (existing?.length) return "duplicate" as const;

  const { error } = await supabase.from("song_requests").insert({
    invitation_id: input.invitationId,
    display_name: input.displayName,
    song: input.song,
    artist: input.artist,
  });
  if (error?.code === "23505") return "duplicate" as const;
  if (error) throw error;
  return "created" as const;
}

export async function createMediaUpload(input: {
  invitationId: string | null;
  uploaderName: string | null;
  tableNumber: string | null;
  mimeType: string;
  size: number;
  extension: string;
  message?: string | null;
}) {
  const supabase = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${randomUUID()}.${input.extension}`;
  const completionToken = randomBytes(24).toString("base64url");
  const completionTokenHash = createHash("sha256").update(completionToken).digest("hex");
  const { data: upload, error: uploadError } = await supabase.storage.from(WEDDING_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (uploadError) throw uploadError;

  const { data: record, error: recordError } = await supabase
    .from("photo_uploads")
    .insert({
      invitation_id: input.invitationId,
      uploader_name: input.uploaderName,
      table_number: input.tableNumber,
      storage_path: path,
      mime_type: input.mimeType,
      media_kind: input.mimeType.startsWith("video/") ? "video" : "image",
      file_size: input.size,
      approved: false,
      rejected: false,
      upload_completed: false,
      upload_token_hash: completionTokenHash,
      message: input.message?.trim() || null,
      moderation_status: "PENDING",
    })
    .select("id")
    .single();
  if (recordError) throw recordError;

  return { id: record.id as string, path, token: upload.token, signedUrl: upload.signedUrl, completionToken };
}

export async function markMediaUploadComplete(id: string, completionToken: string, invitationId: string | null) {
  const supabase = createAdminClient();
  const tokenHash = createHash("sha256").update(completionToken).digest("hex");
  let lookup = supabase
    .from("photo_uploads")
    .select("id, storage_path, mime_type, media_kind, file_size, message")
    .eq("id", id)
    .eq("upload_token_hash", tokenHash);
  lookup = invitationId ? lookup.eq("invitation_id", invitationId) : lookup.is("invitation_id", null);
  const { data: record, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) throw lookupError;
  if (!record) throw new Error("Upload completion token is invalid");

  const storage = supabase.storage.from(WEDDING_MEDIA_BUCKET);
  const { data: storedFile, error: infoError } = await storage.info(record.storage_path);
  if (infoError || !storedFile) throw infoError ?? new Error("Uploaded file could not be inspected");
  const actualSize = storedFile.size ?? storedFile.metadata?.size;
  const actualMimeType = storedFile.contentType ?? storedFile.metadata?.mimetype;
  if (!storedUploadMatches({
    expectedMimeType: record.mime_type,
    expectedSize: Number(record.file_size),
    actualMimeType,
    actualSize,
  })) {
    const { error: removeError } = await storage.remove([record.storage_path]);
    if (removeError) throw removeError;
    const { error: deleteError } = await supabase.from("photo_uploads").delete().eq("id", id);
    if (deleteError) throw deleteError;
    throw new Error("Uploaded file metadata does not match the prepared upload");
  }

  const { error } = await supabase
    .from("photo_uploads")
    .update({ upload_completed: true, upload_token_hash: null })
    .eq("id", id)
    .eq("upload_token_hash", tokenHash);
  if (error) throw error;

  const { data: signed } = record.media_kind === "image"
    ? await storage.createSignedUrl(record.storage_path, 5 * 60)
    : { data: null };
  const moderation = await moderateWeddingContent({
    text: record.message,
    imageUrl: signed?.signedUrl ?? null,
    mediaKind: record.media_kind,
  });
  const status = decisionToStatus(moderation.decision);
  const now = new Date().toISOString();
  const { error: moderationError } = await supabase.from("photo_uploads").update({
    moderation_status: status,
    moderation_reason: moderation.reason,
    moderation_categories: moderation.categories,
    moderation_confidence: moderation.confidence,
    approved: status === "APPROVED",
    rejected: status === "BLOCKED",
    approved_at: status === "APPROVED" ? now : null,
    moderated_at: now,
  }).eq("id", id);
  if (moderationError) throw moderationError;
  return status;
}

export async function getApprovedGallery(): Promise<ApprovedMedia[]> {
  const supabase = createAdminClient({ optional: true });
  if (!supabase) return [];

  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "gallery_published").maybeSingle(),
    supabase
      .from("photo_uploads")
      .select("id, storage_path, mime_type, created_at")
      .eq("approved", true)
      .eq("rejected", false)
      .eq("upload_completed", true)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  if (error || settings?.value !== true || !rows?.length) return [];

  const { data: signed } = await supabase.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrls(
    rows.map((row) => row.storage_path),
    60 * 60,
  );

  return rows.flatMap((row, index) => {
    const url = signed?.[index]?.signedUrl;
    if (!url) return [];
    return [{
      id: row.id,
      kind: row.mime_type.startsWith("video/") ? "video" as const : "image" as const,
      url,
      alt: "תמונה שהועלתה מהחתונה של שובל ומיכאל",
      createdAt: row.created_at,
    }];
  });
}
