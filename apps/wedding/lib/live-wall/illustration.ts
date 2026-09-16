import "server-only";

import { Buffer } from "node:buffer";
import { moderateWeddingContent } from "@/lib/moderation";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const ILLUSTRATION_PROMPT = `Transform this wedding guest photo into an elegant editorial watercolor-and-ink illustration for a premium wedding projection screen. Preserve the people, recognizable faces, expressions, pose, clothing, setting, camera angle, and overall composition. Use warm ivory, champagne, muted sage, and subtle midnight-blue accents. Keep it joyful, flattering, refined, and artistic—not grotesque or exaggerated. Do not add or remove people. Do not add text, logos, frames, or watermarks.`;

function selectedForIllustration(id: string): boolean {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 5 === 0;
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function maybeGenerateLiveWallIllustration(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;
  const db = createAdminClient({ optional: true });
  if (!db) return;

  const { data: setting } = await db.from("site_settings").select("value").eq("key", "live_wall_ai_art").maybeSingle();
  if (setting?.value !== true) return;

  const { data: running } = await db
    .from("photo_uploads")
    .select("id, illustration_created_at")
    .eq("illustration_status", "GENERATING")
    .limit(1)
    .maybeSingle();
  if (running) {
    const startedAt = running.illustration_created_at ? new Date(running.illustration_created_at).getTime() : Date.now();
    if (Date.now() - startedAt < 10 * 60_000) return;
    await db.from("photo_uploads").update({ illustration_status: "FAILED" }).eq("id", running.id).eq("illustration_status", "GENERATING");
  }

  const { data: candidate, error: candidateError } = await db
    .from("photo_uploads")
    .select("id, storage_path, mime_type")
    .eq("upload_completed", true)
    .eq("moderation_status", "APPROVED")
    .eq("media_kind", "image")
    .eq("illustration_status", "PENDING")
    .order("approved_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (candidateError) throw candidateError;
  if (!candidate) return;

  if (!selectedForIllustration(candidate.id)) {
    await db.from("photo_uploads").update({ illustration_status: "SKIPPED" }).eq("id", candidate.id).eq("illustration_status", "PENDING");
    return;
  }

  const { data: claimed, error: claimError } = await db
    .from("photo_uploads")
    .update({ illustration_status: "GENERATING", illustration_created_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("illustration_status", "PENDING")
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  const illustrationPath = `illustrations/${candidate.id}.jpg`;
  try {
    const { data: sourceUrl, error: signedError } = await db.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrl(candidate.storage_path, 10 * 60);
    if (signedError || !sourceUrl?.signedUrl) throw signedError ?? new Error("Could not sign illustration source");
    const sourceResponse = await fetch(sourceUrl.signedUrl, { signal: AbortSignal.timeout(30_000) });
    if (!sourceResponse.ok) throw new Error(`Could not download illustration source (${sourceResponse.status})`);

    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare");
    form.append("image[]", await sourceResponse.blob(), `wedding.${extensionFor(candidate.mime_type)}`);
    form.append("prompt", ILLUSTRATION_PROMPT);
    form.append("quality", "low");
    form.append("size", "1536x1024");
    form.append("output_format", "jpeg");
    form.append("output_compression", "78");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(170_000),
    });
    if (!response.ok) throw new Error(`Illustration generation failed (${response.status})`);
    const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) throw new Error("Illustration generation returned no image");

    const { error: uploadError } = await db.storage.from(WEDDING_MEDIA_BUCKET).upload(
      illustrationPath,
      Buffer.from(encoded, "base64"),
      { contentType: "image/jpeg", cacheControl: "3600", upsert: true },
    );
    if (uploadError) throw uploadError;

    const { data: generatedUrl } = await db.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrl(illustrationPath, 10 * 60);
    const moderation = await moderateWeddingContent({ imageUrl: generatedUrl?.signedUrl ?? null, mediaKind: "image" });
    if (moderation.decision !== "approved") {
      await db.storage.from(WEDDING_MEDIA_BUCKET).remove([illustrationPath]);
      await db.from("photo_uploads").update({ illustration_status: "BLOCKED" }).eq("id", candidate.id);
      return;
    }

    const { error: updateError } = await db.from("photo_uploads").update({
      illustration_path: illustrationPath,
      illustration_status: "READY",
      illustration_created_at: new Date().toISOString(),
    }).eq("id", candidate.id);
    if (updateError) throw updateError;
  } catch (error) {
    console.error("Live Wall illustration generation failed", error);
    await db.storage.from(WEDDING_MEDIA_BUCKET).remove([illustrationPath]).catch(() => undefined);
    await db.from("photo_uploads").update({ illustration_status: "FAILED" }).eq("id", candidate.id);
  }
}
