// Runs a persistent local MongoDB for development: `pnpm db:local`.
// Uses the mongodb-memory-server binary, so nothing needs installing
// (MongoDB ships no native Windows-on-ARM build; x64 runs under emulation).
// Data lives in .data/mongo (git-ignored). Stop with Ctrl+C.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const port = Number(process.env.LOCAL_DB_PORT ?? 27017);
const dbPath = resolve(".data/mongo");
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  // Bound to localhost only: the database is never exposed to the LAN.
  instance: { port, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
  binary: process.platform === "win32" && process.arch === "arm64" ? { arch: "x64" } : {},
});

console.log(`Local MongoDB running at ${server.getUri("utang-club")}`);
console.log(`Data directory: ${dbPath}`);
console.log("Press Ctrl+C to stop.");

const shutdown = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
