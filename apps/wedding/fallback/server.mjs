import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";

const run = promisify(execFile);

const port = Number(process.env.WEDDING_FALLBACK_PORT || 8789);
const publicUrl = (process.env.WEDDING_FALLBACK_PUBLIC_URL || "https://wedding-origin.my-rem.com").replace(/\/$/, "");
const internalRoot = path.join(os.homedir(), "Library/Application Support/ShovalMichaelWedding");
const dataRoot = process.env.WEDDING_FALLBACK_DATA_DIR || internalRoot;
const mediaRoot = path.join(dataRoot, "media");
const maxMediaBytes = 50 * 1024 * 1024;
const allowedMedia = new Map([
  ["image/jpeg", new Set(["jpg", "jpeg"])], ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])], ["image/heic", new Set(["heic"])],
  ["image/heif", new Set(["heif"])], ["video/mp4", new Set(["mp4", "m4v"])],
  ["video/quicktime", new Set(["mov", "qt"])], ["video/webm", new Set(["webm"])],
]);
fs.mkdirSync(mediaRoot, { recursive: true });

function loadSecret() {
  if (process.env.WEDDING_FALLBACK_SECRET) return process.env.WEDDING_FALLBACK_SECRET;
  try {
    return execFileSync("/usr/bin/security", ["find-generic-password", "-w", "-s", "wedding-fallback-shared-secret"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error("Missing wedding fallback shared secret in environment or macOS Keychain");
  }
}
const secret = loadSecret();
const db = new DatabaseSync(path.join(dataRoot, "wedding-fallback.sqlite"));
db.exec(`
  pragma journal_mode = WAL;
  pragma synchronous = FULL;
  pragma foreign_keys = ON;
  create table if not exists submissions (
    id text primary key,
    kind text not null check (kind in ('photo','video','blessing','song')),
    invitation_id text,
    display_name text,
    message text,
    artist text,
    media_path text,
    preview_path text,
    mime_type text,
    file_size integer,
    upload_token_hash text,
    completion_token_hash text,
    upload_completed integer not null default 0,
    moderation_status text not null default 'PENDING' check (moderation_status in ('PENDING','APPROVED','NEEDS_REVIEW','BLOCKED')),
    moderation_reason text,
    hidden_at text,
    approved_at text,
    created_at text not null
  );
  create index if not exists submissions_wall_idx on submissions (moderation_status, hidden_at, created_at desc);
  create table if not exists photo_likes (
    photo_id text not null references submissions(id) on delete cascade,
    visitor_hash text not null,
    invitation_id text,
    created_at text not null,
    primary key (photo_id, visitor_hash)
  );
  create table if not exists reactions (
    id text primary key,
    invitation_id text,
    session_hash text not null,
    emoji text not null,
    created_at text not null
  );
  create table if not exists operation_log (
    id text primary key,
    operation text not null,
    payload text not null,
    created_at text not null,
    synced_at text
  );
  create table if not exists rate_limits (
    action text not null,
    identifier_hash text not null,
    bucket_start integer not null,
    request_count integer not null,
    primary key (action, identifier_hash, bucket_start)
  );
  create table if not exists site_settings (
    key text primary key,
    value integer not null,
    updated_at text not null
  );
  create table if not exists whatsapp_sends (
    operation_id text primary key,
    recipient_hash text not null,
    provider_message_id text not null,
    created_at text not null
  );
  create table if not exists invitation_activity (
    id text primary key,
    invitation_id text not null,
    display_name text,
    event_type text not null check (event_type in ('link_opened','rsvp_page_viewed','interaction','rsvp_saved','rsvp_failed')),
    target text,
    details text not null default '{}',
    created_at text not null
  );
  create index if not exists invitation_activity_created_idx on invitation_activity (created_at desc);
  create index if not exists invitation_activity_invitation_idx on invitation_activity (invitation_id, created_at desc);
`);
if (!db.prepare("pragma table_info(submissions)").all().some((column) => column.name === "preview_path")) {
  db.exec("alter table submissions add column preview_path text");
}
const startedAt = new Date().toISOString();
for (const [key, value] of [["gallery_published", 1], ["live_wall_enabled", 1], ["live_wall_paused", 0], ["live_wall_blank", 0]]) {
  db.prepare("insert or ignore into site_settings (key, value, updated_at) values (?, ?, ?)").run(key, value, startedAt);
}

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };
function json(response, status, body) {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(body));
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function signature(value) { return createHmac("sha256", secret).update(value).digest("hex"); }
function safeEqual(left, right) {
  const a = Buffer.from(left || ""), b = Buffer.from(right || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
function hasStorageCapacity(bytes) {
  const storage = fs.statfsSync(dataRoot);
  const available = Number(storage.bavail) * Number(storage.bsize);
  return available - bytes >= 2 * 1024 * 1024 * 1024;
}
function authorized(request, body) {
  const timestamp = request.headers["x-wedding-timestamp"] || "";
  const supplied = request.headers["x-wedding-signature"] || "";
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300_000) return false;
  return safeEqual(supplied, signature(`${timestamp}.${body}`));
}
async function readBody(request, maxBytes = 128 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function recordOperation(operation, payload) {
  db.prepare("insert or ignore into operation_log (id, operation, payload, created_at) values (?, ?, ?, ?)")
    .run(payload.operationId || randomUUID(), operation, JSON.stringify(payload), new Date().toISOString());
}
function mediaUrl(mediaPath) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  return `${publicUrl}/media/${encodeURIComponent(mediaPath)}?expires=${expires}&signature=${signature(`${mediaPath}.${expires}`)}`;
}
async function generateVideoPreview(mediaPath, id) {
  const previewPath = `_previews/${id}.jpg`;
  const source = path.join(mediaRoot, mediaPath);
  const target = path.join(mediaRoot, previewPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    await run(process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg", [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", "0.1", "-i", source,
      "-vf", "thumbnail=30,scale=960:-2:force_original_aspect_ratio=decrease", "-frames:v", "1", "-q:v", "4", target,
    ], { timeout: 25_000, killSignal: "SIGKILL" });
    return previewPath;
  } catch (error) {
    console.error("Video preview generation failed", error);
    try { fs.unlinkSync(target); } catch {}
    return null;
  }
}
function wallPayload() {
  const rows = db.prepare("select id, kind, display_name, message, media_path, created_at from submissions where upload_completed = 1 and moderation_status = 'APPROVED' and hidden_at is null and kind in ('photo','video','blessing') order by created_at desc limit 48").all();
  const counts = db.prepare("select kind, count(*) count from submissions where upload_completed = 1 group by kind").all();
  const count = (kind) => Number(counts.find((item) => item.kind === kind)?.count || 0);
  const reactions = db.prepare("select id, emoji, created_at from reactions where created_at >= ? order by created_at limit 30").all(new Date(Date.now() - 30_000).toISOString());
  const settings = Object.fromEntries(db.prepare("select key, value from site_settings").all().map((row) => [row.key, Boolean(row.value)]));
  return {
    items: rows.map((row) => ({ id: `${row.kind === "blessing" ? "blessing" : "photo"}:${row.id}`, kind: row.kind === "blessing" ? "blessing" : row.message ? "photo_blessing" : "photo", displayName: row.display_name, message: row.message, mediaUrl: row.media_path ? mediaUrl(row.media_path) : null, createdAt: row.created_at })),
    stats: { photos: count("photo") + count("video"), blessings: count("blessing") },
    controls: { enabled: settings.live_wall_enabled !== false, paused: settings.live_wall_paused === true, blank: settings.live_wall_blank === true }, reactions, generatedAt: new Date().toISOString(), source: "mac-fallback",
  };
}

async function handleSigned(request, response, pathname) {
  const body = request.method === "GET" ? "" : await readBody(request);
  if (!authorized(request, body)) return json(response, 401, { error: "unauthorized" });
  const payload = body ? JSON.parse(body) : {};
  const now = new Date().toISOString();

  if (request.method === "GET" && pathname === "/v1/live") return json(response, 200, wallPayload());
  if (request.method === "GET" && pathname === "/v1/invitation-activity") {
    const events = db.prepare("select id, invitation_id, display_name, event_type, target, details, created_at from invitation_activity order by created_at desc limit 500")
      .all().map((event) => ({ ...event, details: JSON.parse(event.details) }));
    return json(response, 200, { events });
  }
  if (request.method === "POST" && pathname === "/v1/invitation-activity") {
    const eventTypes = new Set(["link_opened", "rsvp_page_viewed", "interaction", "rsvp_saved", "rsvp_failed"]);
    const details = payload.details && typeof payload.details === "object" && !Array.isArray(payload.details) ? payload.details : {};
    const validDetails = Object.keys(details).every((key) => key === "numberConfirmed") &&
      (details.numberConfirmed === undefined || (Number.isSafeInteger(details.numberConfirmed) && details.numberConfirmed >= 0));
    if (!/^[0-9a-f-]{36}$/i.test(payload.id || "") || !/^[0-9a-f-]{36}$/i.test(payload.invitationId || "") ||
      !eventTypes.has(payload.eventType) || (payload.target != null && (typeof payload.target !== "string" || payload.target.length > 80)) ||
      (payload.displayName != null && (typeof payload.displayName !== "string" || payload.displayName.length > 120)) || !validDetails ||
      typeof payload.createdAt !== "string" || !Number.isFinite(Date.parse(payload.createdAt))) {
      return json(response, 400, { error: "invalid activity event" });
    }
    db.prepare("insert or ignore into invitation_activity (id, invitation_id, display_name, event_type, target, details, created_at) values (?, ?, ?, ?, ?, ?, ?)")
      .run(payload.id, payload.invitationId, payload.displayName || null, payload.eventType, payload.target || null, JSON.stringify(details), payload.createdAt);
    return json(response, 200, { success: true });
  }
  if (request.method === "POST" && pathname === "/v1/whatsapp/send") {
    if (!/^[0-9a-f-]{36}$/i.test(payload.operationId || "") || !/^972\d{8,9}$/.test(payload.recipient || "") || typeof payload.message !== "string" || payload.message.length < 1 || payload.message.length > 4096 || (payload.mediaUrl != null && payload.mediaUrl !== "https://wedding.my-rem.com/images/wedding-invitation.jpg")) {
      return json(response, 400, { error: "invalid send request" });
    }
    const previous = db.prepare("select provider_message_id from whatsapp_sends where operation_id = ?").get(payload.operationId);
    if (previous) return json(response, 200, { messageId: previous.provider_message_id, duplicate: true });
    let agentResponse;
    try {
      agentResponse = await fetch(`http://127.0.0.1:${Number(process.env.WEDDING_WHATSAPP_CONTROL_PORT || 8790)}/send`, {
        method: "POST",
        headers: { "authorization": `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return json(response, 503, { error: "whatsapp agent unavailable" });
    }
    const result = await agentResponse.json().catch(() => ({}));
    if (!agentResponse.ok || typeof result.messageId !== "string") return json(response, 503, { error: "whatsapp send failed" });
    db.prepare("insert into whatsapp_sends (operation_id, recipient_hash, provider_message_id, created_at) values (?, ?, ?, ?)")
      .run(payload.operationId, sha256(payload.recipient), result.messageId, now);
    recordOperation("whatsapp-send", { operationId: payload.operationId, providerMessageId: result.messageId });
    return json(response, 200, { messageId: result.messageId });
  }
  if (request.method === "POST" && pathname === "/v1/gallery") {
    const published = db.prepare("select value from site_settings where key = 'gallery_published'").get()?.value !== 0;
    if (!published) return json(response, 200, { media: [] });
    const rows = db.prepare("select id, kind, media_path, created_at from submissions where upload_completed = 1 and moderation_status = 'APPROVED' and hidden_at is null and kind in ('photo','video') order by created_at desc limit 60").all();
    const countStatement = db.prepare("select count(*) count from photo_likes where photo_id = ?");
    const likedStatement = db.prepare("select 1 from photo_likes where photo_id = ? and visitor_hash = ?");
    return json(response, 200, { media: rows.map((row) => ({ id: row.id, kind: row.kind === "video" ? "video" : "image", url: mediaUrl(row.media_path), alt: "תמונה שהועלתה מהחתונה של שובל ומיכאל", createdAt: row.created_at, likeCount: Number(countStatement.get(row.id).count), likedByViewer: payload.viewerHash ? Boolean(likedStatement.get(row.id, payload.viewerHash)) : false })) });
  }
  if (request.method === "POST" && (pathname === "/v1/likes/toggle" || pathname === "/v1/likes/set")) {
    const photo = db.prepare("select id from submissions where id = ? and upload_completed = 1 and moderation_status = 'APPROVED' and hidden_at is null and kind in ('photo','video')").get(payload.photoId);
    if (!photo) return json(response, 404, { error: "not found" });
    const existing = db.prepare("select 1 from photo_likes where photo_id = ? and visitor_hash = ?").get(payload.photoId, payload.visitorHash);
    const liked = pathname === "/v1/likes/set" ? Boolean(payload.liked) : !existing;
    if (!liked) db.prepare("delete from photo_likes where photo_id = ? and visitor_hash = ?").run(payload.photoId, payload.visitorHash);
    else if (!existing) db.prepare("insert into photo_likes (photo_id, visitor_hash, invitation_id, created_at) values (?, ?, ?, ?)").run(payload.photoId, payload.visitorHash, payload.invitationId || null, now);
    const count = Number(db.prepare("select count(*) count from photo_likes where photo_id = ?").get(payload.photoId).count);
    recordOperation("photo-like", payload); return json(response, 200, { liked, likeCount: count });
  }
  if (request.method === "POST" && pathname === "/v1/rate-limit") {
    const bucketStart = Math.floor(Date.now() / 1000 / payload.windowSeconds) * payload.windowSeconds;
    db.prepare("insert into rate_limits (action, identifier_hash, bucket_start, request_count) values (?, ?, ?, 1) on conflict (action, identifier_hash, bucket_start) do update set request_count = request_count + 1")
      .run(payload.action, payload.identifierHash, bucketStart);
    const row = db.prepare("select request_count from rate_limits where action = ? and identifier_hash = ? and bucket_start = ?").get(payload.action, payload.identifierHash, bucketStart);
    db.prepare("delete from rate_limits where bucket_start < ?").run(Math.floor(Date.now() / 1000) - 86400);
    return json(response, 200, { allowed: row.request_count <= payload.limit, remaining: Math.max(0, payload.limit - row.request_count), resetAt: new Date((bucketStart + payload.windowSeconds) * 1000).toISOString() });
  }
  if (request.method === "POST" && pathname === "/v1/settings") {
    const allowed = new Set(["gallery_published", "live_wall_enabled", "live_wall_paused", "live_wall_blank"]);
    if (!allowed.has(payload.key) || typeof payload.value !== "boolean") return json(response, 400, { error: "invalid setting" });
    db.prepare("insert into site_settings (key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at")
      .run(payload.key, payload.value ? 1 : 0, now);
    recordOperation("setting", payload); return json(response, 200, { success: true });
  }
  if (request.method === "POST" && pathname === "/v1/moderation") {
    const row = db.prepare("select id, media_path, preview_path from submissions where id = ?").get(payload.id);
    if (!row) return json(response, 404, { error: "not found" });
    if (payload.action === "delete") {
      db.prepare("delete from submissions where id = ?").run(payload.id);
      if (row.media_path) try { fs.unlinkSync(path.join(mediaRoot, row.media_path)); } catch {}
      if (row.preview_path) try { fs.unlinkSync(path.join(mediaRoot, row.preview_path)); } catch {}
    } else if (payload.action === "hide") db.prepare("update submissions set hidden_at = ? where id = ?").run(now, payload.id);
    else if (payload.action === "restore") db.prepare("update submissions set hidden_at = null where id = ?").run(payload.id);
    else if (payload.action === "approve") db.prepare("update submissions set moderation_status = 'APPROVED', hidden_at = null, approved_at = ? where id = ?").run(now, payload.id);
    else if (payload.action === "block") db.prepare("update submissions set moderation_status = 'BLOCKED', approved_at = null where id = ?").run(payload.id);
    else return json(response, 400, { error: "invalid action" });
    recordOperation("moderation", payload); return json(response, 200, { success: true });
  }
  if (request.method === "POST" && pathname === "/v1/blessings") {
    const duplicate = payload.invitationId
      ? db.prepare("select moderation_status from submissions where kind = 'blessing' and invitation_id = ? and message = ? and created_at >= ? limit 1").get(payload.invitationId, payload.message, new Date(Date.now() - 5 * 60_000).toISOString())
      : db.prepare("select moderation_status from submissions where kind = 'blessing' and invitation_id is null and display_name = ? and message = ? and created_at >= ? limit 1").get(payload.displayName, payload.message, new Date(Date.now() - 5 * 60_000).toISOString());
    if (duplicate) return json(response, 200, { success: true, duplicate: true, moderationStatus: duplicate.moderation_status });
    db.prepare("insert or ignore into submissions (id, kind, invitation_id, display_name, message, upload_completed, moderation_status, moderation_reason, approved_at, created_at) values (?, 'blessing', ?, ?, ?, 1, ?, ?, ?, ?)")
      .run(payload.id, payload.invitationId || null, payload.displayName, payload.message, payload.moderationStatus, payload.moderationReason || null, payload.moderationStatus === "APPROVED" ? now : null, payload.createdAt || now);
    recordOperation("blessing", payload); return json(response, 200, { success: true, duplicate: false, moderationStatus: payload.moderationStatus });
  }
  if (request.method === "POST" && pathname === "/v1/songs") {
    const duplicate = payload.invitationId
      ? db.prepare("select id from submissions where kind = 'song' and invitation_id = ? and message = ? and artist = ? limit 1").get(payload.invitationId, payload.song, payload.artist)
      : db.prepare("select id from submissions where kind = 'song' and invitation_id is null and display_name = ? and message = ? and artist = ? limit 1").get(payload.displayName, payload.song, payload.artist);
    if (duplicate) return json(response, 200, { success: true, duplicate: true });
    db.prepare("insert or ignore into submissions (id, kind, invitation_id, display_name, message, artist, upload_completed, moderation_status, created_at) values (?, 'song', ?, ?, ?, ?, 1, 'APPROVED', ?)")
      .run(payload.id, payload.invitationId || null, payload.displayName, payload.song, payload.artist, payload.createdAt || now);
    recordOperation("song", payload); return json(response, 200, { success: true, duplicate: false });
  }
  if (request.method === "POST" && pathname === "/v1/reactions") {
    db.prepare("insert or ignore into reactions (id, invitation_id, session_hash, emoji, created_at) values (?, ?, ?, ?, ?)")
      .run(payload.id, payload.invitationId || null, payload.sessionHash, payload.emoji, payload.createdAt || now);
    recordOperation("reaction", payload); return json(response, 200, { success: true });
  }
  if (request.method === "POST" && pathname === "/v1/uploads/prepare") {
    if (!Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > 10) return json(response, 400, { error: "invalid upload batch" });
    const invalidFile = payload.files.find((file) => !allowedMedia.get(file.mimeType)?.has(file.extension) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxMediaBytes);
    if (invalidFile) return json(response, 400, { error: "invalid media" });
    if (!hasStorageCapacity(payload.files.reduce((total, file) => total + file.size, 0))) return json(response, 507, { error: "insufficient storage" });
    const uploads = payload.files.map((file) => {
      const id = randomUUID(), uploadToken = randomBytes(24).toString("base64url"), completionToken = randomBytes(24).toString("base64url");
      const mediaPath = `${new Date().toISOString().slice(0, 10)}/${id}.${file.extension}`;
      db.prepare("insert into submissions (id, kind, invitation_id, display_name, message, media_path, mime_type, file_size, upload_token_hash, completion_token_hash, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, file.mediaKind === "video" ? "video" : "photo", payload.invitationId || null, payload.displayName || null, payload.message || null, mediaPath, file.mimeType, file.size, sha256(uploadToken), sha256(completionToken), now);
      return { id, backend: "fallback", signedUrl: `${publicUrl}/uploads/${id}?token=${uploadToken}`, completionToken };
    });
    return json(response, 200, { uploads });
  }
  if (request.method === "POST" && pathname === "/v1/uploads/complete") {
    let row = db.prepare("select * from submissions where id = ? and completion_token_hash = ?").get(payload.id, sha256(payload.completionToken));
    if (!row || !row.upload_completed) return json(response, 400, { error: "invalid upload" });
    if (row.kind === "video" && !row.preview_path) {
      const previewPath = await generateVideoPreview(row.media_path, row.id);
      if (previewPath) db.prepare("update submissions set preview_path = ? where id = ?").run(previewPath, row.id);
      row = db.prepare("select * from submissions where id = ?").get(row.id);
    }
    return json(response, 200, { id: row.id, message: row.message, mediaKind: row.kind === "video" ? "video" : "image", mediaUrl: mediaUrl(row.media_path), previewImageUrl: row.kind === "video" && row.preview_path ? mediaUrl(row.preview_path) : mediaUrl(row.media_path) });
  }
  if (request.method === "POST" && pathname === "/v1/uploads/moderate") {
    db.prepare("update submissions set moderation_status = ?, moderation_reason = ?, approved_at = ?, completion_token_hash = null where id = ?")
      .run(payload.status, payload.reason || null, payload.status === "APPROVED" ? now : null, payload.id);
    recordOperation("upload-moderation", payload); return json(response, 200, { success: true });
  }
  if (request.method === "POST" && pathname === "/v1/uploads/mirror") {
    const source = new URL(payload.mediaUrl);
    if (!source.hostname.endsWith(".supabase.co")) return json(response, 400, { error: "invalid media source" });
    const target = path.join(mediaRoot, payload.mediaPath);
    const existing = db.prepare("select id, kind, media_path, preview_path from submissions where id = ?").get(payload.id);
    if (existing) return json(response, 200, { success: true, duplicate: true, previewImageUrl: existing.kind === "video" && existing.preview_path ? mediaUrl(existing.preview_path) : mediaUrl(existing.media_path) });
    const download = await fetch(source, { signal: AbortSignal.timeout(30_000) });
    if (!download.ok || !download.body) return json(response, 502, { error: "mirror download failed" });
    const declaredSize = Number(download.headers.get("content-length") || payload.fileSize || 0);
    if (!declaredSize || declaredSize > maxMediaBytes) return json(response, 400, { error: "invalid media size" });
    if (!hasStorageCapacity(declaredSize)) return json(response, 507, { error: "insufficient storage" });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const file = fs.createWriteStream(target, { flags: "wx" }); let downloaded = 0;
    try {
      for await (const chunk of download.body) { downloaded += chunk.length; if (downloaded > maxMediaBytes) throw new Error("mirror too large"); if (!file.write(chunk)) await new Promise((resolve) => file.once("drain", resolve)); }
      await new Promise((resolve, reject) => file.end((error) => error ? reject(error) : resolve()));
    } catch (error) {
      file.destroy(); try { fs.unlinkSync(target); } catch {} throw error;
    }
    const previewPath = payload.mediaKind === "video" ? await generateVideoPreview(payload.mediaPath, payload.id) : null;
    db.prepare("insert into submissions (id, kind, invitation_id, display_name, message, media_path, preview_path, mime_type, file_size, upload_completed, moderation_status, moderation_reason, approved_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)")
      .run(payload.id, payload.mediaKind === "video" ? "video" : "photo", payload.invitationId || null, payload.displayName || null, payload.message || null, payload.mediaPath, previewPath, payload.mimeType, downloaded, payload.status, payload.reason || null, payload.status === "APPROVED" ? now : null, payload.createdAt || now);
    recordOperation("upload-mirror", payload); return json(response, 200, { success: true, previewImageUrl: previewPath ? mediaUrl(previewPath) : mediaUrl(payload.mediaPath) });
  }
  return json(response, 404, { error: "not found" });
}

async function handleUpload(request, response, id, token) {
  const row = db.prepare("select * from submissions where id = ? and upload_token_hash = ? and upload_completed = 0").get(id, sha256(token || ""));
  if (!row) return json(response, 403, { error: "invalid upload token" });
  if (Number(request.headers["content-length"] || 0) !== row.file_size) return json(response, 400, { error: "size mismatch" });
  const target = path.join(mediaRoot, row.media_path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stream = fs.createWriteStream(target, { flags: "wx" });
  let size = 0;
  try {
    for await (const chunk of request) { size += chunk.length; if (size > row.file_size) throw new Error("too large"); if (!stream.write(chunk)) await new Promise((resolve) => stream.once("drain", resolve)); }
    await new Promise((resolve, reject) => stream.end((error) => error ? reject(error) : resolve()));
    if (size !== row.file_size) throw new Error("size mismatch");
    db.prepare("update submissions set upload_completed = 1, upload_token_hash = null where id = ?").run(id);
    response.writeHead(204, { "access-control-allow-origin": "https://wedding.my-rem.com" }); return response.end();
  } catch (error) {
    stream.destroy(); try { fs.unlinkSync(target); } catch {} return json(response, 400, { error: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, publicUrl);
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok", storage: dataRoot.startsWith("/Volumes/") ? "external" : "internal" });
    if (request.method === "OPTIONS" && url.pathname.startsWith("/uploads/")) { response.writeHead(204, { "access-control-allow-origin": "https://wedding.my-rem.com", "access-control-allow-methods": "PUT,OPTIONS", "access-control-allow-headers": "content-type" }); return response.end(); }
    if (request.method === "PUT" && url.pathname.startsWith("/uploads/")) return await handleUpload(request, response, url.pathname.split("/").pop(), url.searchParams.get("token"));
    if (request.method === "GET" && url.pathname.startsWith("/media/")) {
      const mediaPath = decodeURIComponent(url.pathname.slice(7)), expires = Number(url.searchParams.get("expires")), supplied = url.searchParams.get("signature");
      if (!expires || expires < Date.now() / 1000 || !safeEqual(supplied, signature(`${mediaPath}.${expires}`))) return json(response, 403, { error: "expired" });
      const target = path.join(mediaRoot, mediaPath); if (!target.startsWith(mediaRoot) || !fs.existsSync(target)) return json(response, 404, { error: "not found" });
      const media = db.prepare("select mime_type from submissions where media_path = ? or preview_path = ?").get(mediaPath, mediaPath);
      const contentType = mediaPath.endsWith(".jpg") ? "image/jpeg" : media?.mime_type || "application/octet-stream";
      response.writeHead(200, { "content-type": contentType, "content-length": fs.statSync(target).size, "cache-control": "private, max-age=3600", "access-control-allow-origin": "https://wedding.my-rem.com" }); return fs.createReadStream(target).pipe(response);
    }
    if (url.pathname.startsWith("/v1/")) return await handleSigned(request, response, url.pathname);
    return json(response, 404, { error: "not found" });
  } catch (error) { console.error(error); return json(response, 500, { error: "internal error" }); }
});
server.listen(port, "127.0.0.1", () => console.log(`Wedding fallback listening on 127.0.0.1:${port} (${dataRoot})`));
