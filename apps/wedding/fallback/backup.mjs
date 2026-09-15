import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { backup, DatabaseSync } from "node:sqlite";

const run = promisify(execFile);

const sourceRoot = process.env.WEDDING_FALLBACK_DATA_DIR || path.join(os.homedir(), "Library/Application Support/ShovalMichaelWedding");
const destinationRoot = process.env.WEDDING_FALLBACK_BACKUP_DIR || "/Volumes/My Passport/Wedding-Shoval-Michael/fallback-backup";

const { stdout: mountedVolumes } = await run("/sbin/mount");
if (!mountedVolumes.includes(" on /Volumes/My Passport ")) {
  process.exit(0);
}

const sourceDatabase = path.join(sourceRoot, "wedding-fallback.sqlite");
try {
  await fs.access(sourceDatabase);
} catch {
  process.exit(0);
}

const temporarySnapshot = path.join(os.tmpdir(), `wedding-fallback-${process.pid}.sqlite`);
const temporaryManifest = path.join(os.tmpdir(), `wedding-fallback-${process.pid}.json`);
const database = new DatabaseSync(sourceDatabase, { readOnly: true });
try {
  await backup(database, temporarySnapshot);
} finally {
  database.close();
}
try {
  await fs.writeFile(temporaryManifest, JSON.stringify({ completedAt: new Date().toISOString() }, null, 2));
  const options = { timeout: 30_000, killSignal: "SIGKILL" };
  await run("/bin/mkdir", ["-p", destinationRoot], options);
  await run("/usr/bin/rsync", ["-a", "--delete", `${path.join(sourceRoot, "media")}/`, `${destinationRoot}/media/`], options);
  await run("/usr/bin/rsync", ["-a", temporarySnapshot, `${destinationRoot}/wedding-fallback.sqlite`], options);
  await run("/usr/bin/rsync", ["-a", temporaryManifest, `${destinationRoot}/last-backup.json`], options);
} finally {
  await fs.rm(temporarySnapshot, { force: true });
  await fs.rm(temporaryManifest, { force: true });
}

// node:sqlite backup may keep an internal handle alive after completion.
process.exit(0);
