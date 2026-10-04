// Backs up the database to a dated folder: `pnpm backup`.
// Restores one into an EMPTY database: `pnpm restore <folder>`.
//
// Each collection becomes one Extended JSON file (types such as ObjectId and
// Date survive the round trip). Sessions and sign-in throttle counters are
// skipped: they are short-lived, and restoring them would be pointless.
// The users file holds password hashes: keep backups private.
// Runs with Node's built-in TypeScript support and reads .env.local.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { argv, stderr, stdout } from "node:process";
import mongoose from "mongoose";

const COLLECTIONS = ["users", "tabs", "tabshares", "people", "transactions"] as const;
const { EJSON } = mongoose.mongo.BSON;

const uri = process.env.MONGODB_URI;
if (!uri) {
  stderr.write("MONGODB_URI is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

const [command, folder] = argv.slice(2);
if (command !== "backup" && command !== "restore") {
  stderr.write("Usage: pnpm backup | pnpm restore <backup folder>\n");
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
const db = mongoose.connection.db!;
try {
  if (command === "backup") await backup();
  else await restore(folder);
} finally {
  await mongoose.disconnect();
}

async function backup() {
  // 2026-10-04T12-30-05: sortable and safe in file names on every OS.
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const target = resolve(".data/backups", `utang-club-${stamp}`);
  await mkdir(target, { recursive: true });
  for (const name of COLLECTIONS) {
    const documents = await db.collection(name).find().toArray();
    await writeFile(join(target, `${name}.json`), EJSON.stringify(documents, undefined, 0, { relaxed: false }));
    stdout.write(`${name}: ${documents.length}\n`);
  }
  stdout.write(`\nSaved to ${target}\n`);
}

async function restore(source: string | undefined) {
  if (!source) {
    stderr.write("Say which backup to restore: pnpm restore .data/backups/utang-club-…\n");
    process.exit(1);
  }
  const files = new Set(await readdir(source));
  // Backups made before sharing existed (D19) have no tabshares file; that just means none.
  const optional = new Set(["tabshares"]);
  const missing = COLLECTIONS.filter((name) => !files.has(`${name}.json`) && !optional.has(name));
  if (missing.length > 0) {
    stderr.write(`Not a complete backup: ${missing.join(", ")} missing in ${source}\n`);
    process.exit(1);
  }
  // Never merge into or overwrite live data.
  for (const name of COLLECTIONS) {
    if ((await db.collection(name).estimatedDocumentCount()) > 0) {
      stderr.write(
        `The database already has ${name}. Restore only goes into an empty database: ` +
          "see SETUP.md → Starting fresh, or point MONGODB_URI at a new database.\n",
      );
      process.exit(1);
    }
  }
  for (const name of COLLECTIONS) {
    if (!files.has(`${name}.json`)) continue;
    const documents = EJSON.parse(await readFile(join(source, `${name}.json`), "utf8"), { relaxed: false }) as Record<string, unknown>[];
    if (documents.length > 0) await db.collection(name).insertMany(documents);
    stdout.write(`${name}: ${documents.length}\n`);
  }
  stdout.write("\nRestored. Start the app; it rebuilds its indexes on first use.\n");
}
