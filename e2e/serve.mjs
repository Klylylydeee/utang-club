// Playwright's web server (see playwright.config.ts). Starts a throwaway
// in-memory MongoDB, seeds an administrator and two users, then runs Next.js against it:
//
//   E2E_MODE=prod (default): `next build` into .next-e2e, then `next start`
//   E2E_MODE=dev:            `next dev`, also in .next-e2e
//
// Every run starts with an empty database, so the registration limit
// (5 per device per 15 minutes) never trips repeated runs, and your own
// data in .data/mongo and your `pnpm dev` on port 3000 are never touched.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { hashPassword } from "../src/lib/auth/password.ts";
import { E2E_PORT, E2E_USERS } from "./constants.ts";

const mode = process.env.E2E_MODE === "dev" ? "dev" : "prod";

const mongo = await MongoMemoryServer.create({
  instance: { ip: "127.0.0.1" },
  binary: process.platform === "win32" && process.arch === "arm64" ? { arch: "x64" } : {},
});
const uri = mongo.getUri("utang-club-e2e");

await mongoose.connect(uri);
const now = new Date();
await mongoose.connection.collection("users").insertMany(
  await Promise.all(
    Object.values(E2E_USERS).map(async (user) => ({
      email: user.email,
      name: user.name,
      passwordHash: await hashPassword(user.password),
      role: user.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })),
  ),
);
await mongoose.disconnect();

// Explicit values win over .env.local, which Next.js would otherwise load
// (it may point at your real database or allow every action origin).
const env = {
  ...process.env,
  MONGODB_URI: uri,
  AUTH_SECRET: randomBytes(32).toString("base64url"),
  ACTION_ALLOWED_ORIGINS: "",
  DEV_ALLOWED_ORIGINS: "",
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

const next = (args) =>
  spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { env, stdio: "inherit" });

let child;
async function shutdown(code = 0) {
  child?.kill();
  await mongo.stop().catch(() => {});
  process.exit(code);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

if (mode === "prod" && !process.env.E2E_SKIP_BUILD) {
  child = next(["build"]);
  const status = await new Promise((resolve) => child.on("exit", resolve));
  if (status !== 0) await shutdown(1);
}

child = next([mode === "dev" ? "dev" : "start", "-H", "0.0.0.0", "-p", String(E2E_PORT)]);
child.on("exit", (status) => shutdown(status ?? 0));
