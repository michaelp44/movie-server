import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { encryptBackup } from "./backup-crypto.mjs";

const drive = process.env.WEDDING_BACKUP_DRIVE || "/Volumes/My Passport";
const passphrase = process.env.WEDDING_BACKUP_PASSPHRASE;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!passphrase || passphrase.length < 20) throw new Error("WEDDING_BACKUP_PASSPHRASE must contain at least 20 characters");
if (!url || !serviceKey) throw new Error("Supabase backup credentials are missing");
if (!resolve(drive).startsWith("/Volumes/") || basename(resolve(drive)) === "") throw new Error("Backup drive must be an explicit mounted volume");
await stat(drive);

const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const destination = join(drive, "Wedding-Shoval-Michael", timestamp);
await mkdir(join(destination, "data"), { recursive: true });
await mkdir(join(destination, "media"), { recursive: true });
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ["wedding_tables", "invitations", "guests", "photo_uploads", "guestbook_messages", "song_requests", "site_settings", "sync_runs", "sync_run_items", "rate_limits", "live_wall_reactions"];
const manifest = { createdAt: new Date().toISOString(), format: "AES-256-GCM/WED1", tables: {}, media: [] };

for (const table of tables) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + 999);
    if (error) throw new Error(`Could not back up ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  manifest.tables[table] = rows.length;
  await writeFile(join(destination, "data", `${table}.json.enc`), encryptBackup(Buffer.from(JSON.stringify(rows)), passphrase), { mode: 0o600 });
}

const { data: mediaRows, error: mediaError } = await client.from("photo_uploads").select("id, storage_path").eq("upload_completed", true);
if (mediaError) throw new Error(`Could not list media: ${mediaError.message}`);
for (const row of mediaRows || []) {
  if (row.storage_path.includes("..")) throw new Error("Unsafe storage path");
  const { data, error } = await client.storage.from("wedding-media").download(row.storage_path);
  if (error) throw new Error(`Could not download ${row.id}: ${error.message}`);
  const output = join(destination, "media", `${row.id}.bin.enc`);
  await writeFile(output, encryptBackup(Buffer.from(await data.arrayBuffer()), passphrase), { mode: 0o600 });
  manifest.media.push({ id: row.id, storagePath: row.storage_path, file: `media/${row.id}.bin.enc` });
}

await writeFile(join(destination, "manifest.json.enc"), encryptBackup(Buffer.from(JSON.stringify(manifest, null, 2)), passphrase), { mode: 0o600 });
console.log(`Encrypted wedding backup completed: ${destination}`);
