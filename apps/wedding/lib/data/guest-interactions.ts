import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";

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
  const { error } = await supabase.from("guestbook_messages").insert({
    invitation_id: input.invitationId,
    display_name: input.displayName,
    message: input.message,
    approved: false,
  });
  if (error) throw error;
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
    })
    .select("id")
    .single();
  if (recordError) throw recordError;

  return { id: record.id as string, path, token: upload.token, signedUrl: upload.signedUrl, completionToken };
}

export async function markMediaUploadComplete(id: string, completionToken: string, invitationId: string | null) {
  const supabase = createAdminClient();
  const tokenHash = createHash("sha256").update(completionToken).digest("hex");
  let lookup = supabase.from("photo_uploads").select("id").eq("id", id).eq("upload_token_hash", tokenHash);
  lookup = invitationId ? lookup.eq("invitation_id", invitationId) : lookup.is("invitation_id", null);
  const { data: record, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) throw lookupError;
  if (!record) throw new Error("Upload completion token is invalid");
  const { error } = await supabase
    .from("photo_uploads")
    .update({ upload_completed: true, upload_token_hash: null })
    .eq("id", id);
  if (error) throw error;
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
