import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { decryptBackup } from "./backup-crypto.mjs";

const [source, output] = process.argv.slice(2);
const passphrase = process.env.WEDDING_BACKUP_PASSPHRASE;
if (!source || !output) throw new Error("Usage: npm run backup:decrypt -- <encrypted-file> <output-file>");
if (!passphrase) throw new Error("WEDDING_BACKUP_PASSPHRASE is missing");
const target = resolve(output);
if (["/", "/Volumes", "/Users"].includes(target) || !basename(target)) throw new Error("Choose an explicit output file");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, decryptBackup(await readFile(resolve(source)), passphrase), { mode: 0o600, flag: "wx" });
console.log(`Decrypted backup file: ${target}`);
