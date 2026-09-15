import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import { storedUploadMatches } from "@/lib/upload/validation";
import { decisionToStatus, moderateWeddingContent } from "@/lib/moderation";
import { fallbackRequest, isFallbackConfigured, operationId } from "@/lib/fallback/client";

export type ApprovedMedia = {
  id: string;
  kind: "image" | "video";
  url: string;
  alt: string;
  createdAt: string;
  likeCount: number;
  likedByViewer: boolean;
};

export async function saveGuestbookMessage(input: {
  invitationId: string | null;
  displayName: string;
  message: string;
}) {
  const mirrorId = operationId();
  const fallbackOnly = async () => {
    const result = await moderateWeddingContent({ text: input.message });
    const status = decisionToStatus(result.decision);
    const saved = await fallbackRequest<{ moderationStatus: string }>("/v1/blessings", { method: "POST", body: { operationId: mirrorId, id: mirrorId, invitationId: input.invitationId, displayName: input.displayName, message: input.message, moderationStatus: status, moderationReason: result.reason } });
    return saved.moderationStatus;
  };
  const supabase = createAdminClient({ optional: true });
  if (!supabase) return fallbackOnly();
  try {
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
  if (isFallbackConfigured()) await fallbackRequest("/v1/blessings", { method: "POST", timeoutMs: 2_000, body: { operationId: data.id, id: data.id, invitationId: input.invitationId, displayName: input.displayName, message: input.message, moderationStatus: status, moderationReason: result.reason } }).catch((error) => console.error("Fallback blessing mirror failed", error));
  return status;
  } catch (error) {
    if (!isFallbackConfigured()) throw error;
    return fallbackOnly();
  }
}

export async function saveSongRequest(input: {
  invitationId: string | null;
  displayName: string;
  song: string;
  artist: string;
}) {
  const id = operationId();
  const fallbackOnly = async () => {
    const result = await fallbackRequest<{ duplicate: boolean }>("/v1/songs", { method: "POST", body: { operationId: id, id, invitationId: input.invitationId, displayName: input.displayName, song: input.song, artist: input.artist } });
    return result.duplicate ? "duplicate" as const : "created" as const;
  };
  const supabase = createAdminClient({ optional: true });
  if (!supabase) return fallbackOnly();
  try {
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
  if (isFallbackConfigured()) await fallbackRequest("/v1/songs", { method: "POST", timeoutMs: 2_000, body: { operationId: id, id, invitationId: input.invitationId, displayName: input.displayName, song: input.song, artist: input.artist } }).catch((mirrorError) => console.error("Fallback song mirror failed", mirrorError));
  return "created" as const;
  } catch (error) {
    if (!isFallbackConfigured()) throw error;
    return fallbackOnly();
  }
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
  const supabase = createAdminClient({ optional: true });
  if (!supabase) {
    const result = await fallbackRequest<{ uploads: Array<{ id: string; backend: "fallback"; signedUrl: string; completionToken: string }> }>("/v1/uploads/prepare", { method: "POST", body: { files: [{ mimeType: input.mimeType, size: input.size, extension: input.extension, mediaKind: input.mimeType.startsWith("video/") ? "video" : "image" }], invitationId: input.invitationId, displayName: input.uploaderName, message: input.message } });
    return { ...result.uploads[0]!, path: "" };
  }
  try {
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

  return { id: record.id as string, path, token: upload.token, signedUrl: upload.signedUrl, completionToken, backend: "supabase" as const };
  } catch (error) {
    if (!isFallbackConfigured()) throw error;
    const result = await fallbackRequest<{ uploads: Array<{ id: string; backend: "fallback"; signedUrl: string; completionToken: string }> }>("/v1/uploads/prepare", { method: "POST", body: { files: [{ mimeType: input.mimeType, size: input.size, extension: input.extension, mediaKind: input.mimeType.startsWith("video/") ? "video" : "image" }], invitationId: input.invitationId, displayName: input.uploaderName, message: input.message } });
    return { ...result.uploads[0]!, path: "" };
  }
}

export async function markMediaUploadComplete(id: string, completionToken: string, invitationId: string | null, backend: "supabase" | "fallback" = "supabase") {
  if (backend === "fallback") {
    const record = await fallbackRequest<{ id: string; message: string | null; mediaKind: "image" | "video"; mediaUrl: string; previewImageUrl: string | null }>("/v1/uploads/complete", { method: "POST", timeoutMs: 35_000, body: { id, completionToken } });
    const moderation = await moderateWeddingContent({ text: record.message, imageUrl: record.previewImageUrl, mediaKind: record.mediaKind });
    const status = decisionToStatus(moderation.decision);
    await fallbackRequest("/v1/uploads/moderate", { method: "POST", body: { operationId: id, id, status, reason: moderation.reason } });
    return status;
  }
  const supabase = createAdminClient();
  const tokenHash = createHash("sha256").update(completionToken).digest("hex");
  let lookup = supabase
    .from("photo_uploads")
    .select("id, invitation_id, uploader_name, storage_path, mime_type, media_kind, file_size, message, created_at")
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

  const { data: signed } = await storage.createSignedUrl(record.storage_path, 5 * 60);
  let moderationImageUrl = record.media_kind === "image" ? signed?.signedUrl ?? null : null;
  let mirrored = false;
  if (isFallbackConfigured() && signed?.signedUrl) {
    try {
      const mirror = await fallbackRequest<{ previewImageUrl: string | null }>("/v1/uploads/mirror", { method: "POST", timeoutMs: 40_000, body: { operationId: id, id, invitationId: record.invitation_id, displayName: record.uploader_name, message: record.message, mediaUrl: signed.signedUrl, mediaPath: record.storage_path, mimeType: record.mime_type, fileSize: record.file_size, mediaKind: record.media_kind, status: "PENDING", reason: null, createdAt: record.created_at } });
      moderationImageUrl = mirror.previewImageUrl ?? moderationImageUrl;
      mirrored = true;
    } catch (error) {
      console.error("Fallback media pre-mirror failed", error);
    }
  }
  const moderation = await moderateWeddingContent({
    text: record.message,
    imageUrl: moderationImageUrl,
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
  if (isFallbackConfigured() && mirrored) {
    await fallbackRequest("/v1/uploads/moderate", { method: "POST", body: { operationId: id, id, status, reason: moderation.reason } }).catch((error) => console.error("Fallback media moderation mirror failed", error));
  } else if (isFallbackConfigured() && signed?.signedUrl) {
    try {
      await fallbackRequest("/v1/uploads/mirror", { method: "POST", timeoutMs: 35_000, body: { operationId: id, id, invitationId: record.invitation_id, displayName: record.uploader_name, message: record.message, mediaUrl: signed.signedUrl, mediaPath: record.storage_path, mimeType: record.mime_type, fileSize: record.file_size, mediaKind: record.media_kind, status, reason: moderation.reason, createdAt: record.created_at } });
    } catch (error) {
      console.error("Fallback media mirror failed", error);
    }
  }
  return status;
}

export async function getApprovedGallery(viewerHash: string | null = null): Promise<ApprovedMedia[]> {
  const supabase = createAdminClient({ optional: true });
  if (!supabase) return isFallbackConfigured() ? (await fallbackRequest<{ media: ApprovedMedia[] }>("/v1/gallery", { method: "POST", body: { viewerHash } })).media : [];

  const fallbackMedia = isFallbackConfigured()
    ? fallbackRequest<{ media: ApprovedMedia[] }>("/v1/gallery", { method: "POST", timeoutMs: 2_000, body: { viewerHash } })
        .then((result) => result.media)
        .catch((error) => {
          console.error("Mac gallery mirror could not be read", error);
          return [];
        })
    : Promise.resolve([]);

  try {
  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "gallery_published").maybeSingle(),
    supabase
      .from("photo_uploads")
      .select("id, storage_path, mime_type, created_at")
      .eq("approved", true)
      .eq("rejected", false)
      .eq("upload_completed", true)
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  if (error) throw error;
  if (settings?.value !== true) return [];

  const { data: likes, error: likesError } = rows?.length ? await supabase
    .from("photo_likes")
    .select("photo_id, visitor_hash")
    .in("photo_id", rows.map((row) => row.id))
    .limit(10_000) : { data: [], error: null };
  if (likesError) console.error("Gallery likes could not be loaded", likesError);
  const likeCounts = new Map<string, number>();
  const likedIds = new Set<string>();
  for (const like of likes ?? []) {
    likeCounts.set(like.photo_id, (likeCounts.get(like.photo_id) ?? 0) + 1);
    if (viewerHash && like.visitor_hash === viewerHash) likedIds.add(like.photo_id);
  }

  const { data: signed } = rows?.length
    ? await supabase.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrls(rows.map((row) => row.storage_path), 60 * 60)
    : { data: [] };

  const primary = (rows ?? []).flatMap((row, index) => {
    const url = signed?.[index]?.signedUrl;
    if (!url) return [];
    return [{
      id: row.id,
      kind: row.mime_type.startsWith("video/") ? "video" as const : "image" as const,
      url,
      alt: "תמונה שהועלתה מהחתונה של שובל ומיכאל",
      createdAt: row.created_at,
      likeCount: likeCounts.get(row.id) ?? 0,
      likedByViewer: likedIds.has(row.id),
    }];
  });
  const merged = new Map(primary.map((item) => [item.id, item]));
  for (const item of await fallbackMedia) {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? {
      ...existing,
      likeCount: Math.max(existing.likeCount, item.likeCount),
      likedByViewer: existing.likedByViewer || item.likedByViewer,
    } : item);
  }
  return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);
  } catch (error) {
    if (!isFallbackConfigured()) throw error;
    console.error("Supabase gallery read failed; using Mac fallback", error);
    return await fallbackMedia;
  }
}
