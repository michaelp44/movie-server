import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWeddingDemoEnabled } from "@/lib/env";
import { WEDDING_MEDIA_BUCKET } from "@/lib/storage";
import type { WallItem } from "./queue";
import { fallbackRequest, isFallbackConfigured } from "@/lib/fallback/client";

export type LiveWallPayload = {
  items: WallItem[];
  stats: { photos: number; blessings: number };
  controls: { enabled: boolean; paused: boolean; blank: boolean };
  reactions: Array<{ id: string; emoji: string; createdAt: string }>;
  generatedAt: string;
};

export function getLiveWallDemoPayload(): LiveWallPayload {
  return {
    items: [
      { id: "demo-photo", kind: "photo_blessing", displayName: "דנה ותום", message: "שתמיד תרקדו יחד כמו הערב ❤️", mediaUrl: "/images/hero-editorial.jpg", createdAt: new Date().toISOString() },
      { id: "demo-blessing", kind: "blessing", displayName: "משפחת כהן", message: "מאחלים לכם חיים מלאים באהבה, צחוק והרפתקאות", mediaUrl: null, createdAt: new Date(Date.now() - 1000).toISOString() },
      { id: "demo-photo-2", kind: "photo", displayName: "נועה", message: null, mediaUrl: "/og.png", createdAt: new Date(Date.now() - 2000).toISOString() },
    ],
    stats: { photos: 27, blessings: 14 },
    controls: { enabled: true, paused: false, blank: false },
    reactions: [],
    generatedAt: new Date().toISOString(),
  };
}

function mergePayloads(primary: LiveWallPayload, secondary: LiveWallPayload | null): LiveWallPayload {
  if (!secondary) return primary;
  const items = new Map(primary.items.map((item) => [item.id, item]));
  for (const item of secondary.items) if (!items.has(item.id)) items.set(item.id, item);
  const reactions = new Map(primary.reactions.map((reaction) => [reaction.id, reaction]));
  for (const reaction of secondary.reactions) if (!reactions.has(reaction.id)) reactions.set(reaction.id, reaction);
  return {
    ...primary,
    items: [...items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 48),
    stats: {
      photos: Math.max(primary.stats.photos, secondary.stats.photos),
      blessings: Math.max(primary.stats.blessings, secondary.stats.blessings),
    },
    reactions: [...reactions.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-30),
    generatedAt: new Date().toISOString(),
  };
}

export async function getLiveWallPayload(): Promise<LiveWallPayload> {
  if (isWeddingDemoEnabled()) return getLiveWallDemoPayload();

  const db = createAdminClient({ optional: true });
  if (!db) {
    if (isFallbackConfigured()) return fallbackRequest<LiveWallPayload>("/v1/live");
    return { items: [], stats: { photos: 0, blessings: 0 }, controls: { enabled: false, paused: false, blank: false }, reactions: [], generatedAt: new Date().toISOString() };
  }
  const fallbackPayload = isFallbackConfigured()
    ? fallbackRequest<LiveWallPayload>("/v1/live", { timeoutMs: 2_000 }).catch((error) => {
        console.error("Mac Live Wall mirror could not be read", error);
        return null;
      })
    : Promise.resolve(null);
  try {
  const [settingsResult, photosResult, blessingsResult, photoCount, blessingCount, reactionsResult] = await Promise.all([
    db.from("site_settings").select("key, value").in("key", ["live_wall_enabled", "live_wall_paused", "live_wall_blank"]),
    db.from("photo_uploads").select("id, uploader_name, storage_path, message, created_at").eq("upload_completed", true).eq("moderation_status", "APPROVED").is("hidden_at", null).order("approved_at", { ascending: false }).limit(24),
    db.from("guestbook_messages").select("id, display_name, message, created_at").eq("moderation_status", "APPROVED").is("hidden_at", null).order("approved_at", { ascending: false }).limit(24),
    db.from("photo_uploads").select("id", { count: "exact", head: true }).eq("upload_completed", true),
    db.from("guestbook_messages").select("id", { count: "exact", head: true }),
    db.from("live_wall_reactions").select("id, emoji, created_at").gte("created_at", new Date(Date.now() - 30_000).toISOString()).order("created_at", { ascending: true }).limit(30),
  ]);
  const paths = (photosResult.data ?? []).map((row) => row.storage_path);
  const anyError = [settingsResult.error, photosResult.error, blessingsResult.error, photoCount.error, blessingCount.error, reactionsResult.error].find(Boolean);
  if (anyError) throw anyError;
  const signed = paths.length ? await db.storage.from(WEDDING_MEDIA_BUCKET).createSignedUrls(paths, 15 * 60) : { data: [] };
  const photos: WallItem[] = (photosResult.data ?? []).flatMap((row, index) => {
    const mediaUrl = signed.data?.[index]?.signedUrl;
    return mediaUrl ? [{ id: `photo:${row.id}`, kind: row.message ? "photo_blessing" : "photo", displayName: row.uploader_name, message: row.message, mediaUrl, createdAt: row.created_at }] : [];
  });
  const blessings: WallItem[] = (blessingsResult.data ?? []).map((row) => ({ id: `blessing:${row.id}`, kind: "blessing", displayName: row.display_name, message: row.message, mediaUrl: null, createdAt: row.created_at }));
  const settings = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value]));
  const primary: LiveWallPayload = {
    items: [...photos, ...blessings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    stats: { photos: photoCount.count ?? 0, blessings: blessingCount.count ?? 0 },
    controls: { enabled: settings.live_wall_enabled !== false, paused: settings.live_wall_paused === true, blank: settings.live_wall_blank === true },
    reactions: (reactionsResult.data ?? []).map((row) => ({ id: row.id, emoji: row.emoji, createdAt: row.created_at })),
    generatedAt: new Date().toISOString(),
  };
  return mergePayloads(primary, await fallbackPayload);
  } catch (error) {
    if (!isFallbackConfigured()) throw error;
    console.error("Supabase Live Wall read failed; using Mac fallback", error);
    return (await fallbackPayload) ?? fallbackRequest<LiveWallPayload>("/v1/live");
  }
}
