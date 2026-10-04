// Runs a persistent local MongoDB for development: `pnpm db:local`.
// Uses the mongodb-memory-server binary, so nothing needs installing
// (MongoDB ships no native Windows-on-ARM build; x64 runs under emulation).
// Data lives in .data/mongo (git-ignored). Stop with Ctrl+C.
import { mkdirSync } from "node:fs";
import { connect } from "node:net";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const port = Number(process.env.LOCAL_DB_PORT ?? 27017);
const dbPath = resolve(".data/mongo");
mkdirSync(dbPath, { recursive: true });

/** True when something already accepts connections on 127.0.0.1:port. */
function isPortTaken(port) {
  return new Promise((done) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

// Windows lets a second server bind the same port, after which connections
// land on either one at random. Refuse instead of starting a duplicate.
if (await isPortTaken(port)) {
  console.error(
    [
      `Something is already listening on 127.0.0.1:${port}.`,
      "",
      "- If it's an earlier `pnpm db:local`, the database is already running. Nothing to do.",
      "- If it's another MongoDB (e.g. a Windows service), stop it, or run this on another",
      `  port: LOCAL_DB_PORT=27018 pnpm db:local, and set MONGODB_URI to match in .env.local.`,
    ].join("\n"),
  );
  process.exit(1);
}

let server;
try {
  server = await MongoMemoryServer.create({
    // Bound to localhost only: the database is never exposed to the LAN.
    instance: { port, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
    binary: process.platform === "win32" && process.arch === "arm64" ? { arch: "x64" } : {},
  });
} catch (error) {
  if (String(error).includes("DBPathInUse")) {
    console.error(
      `Another MongoDB is already using ${dbPath} (probably an earlier \`pnpm db:local\` on a ` +
        "different port). Stop that one first; two servers can't share one data directory.",
    );
    process.exit(1);
  }
  throw error;
}

console.log(`Local MongoDB running at ${server.getUri("utang-club")}`);
console.log(`Data directory: ${dbPath}`);
console.log("Press Ctrl+C to stop.");

const shutdown = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
