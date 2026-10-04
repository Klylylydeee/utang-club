// Creates the first administrator, or promotes an existing account: `pnpm create-admin`.
// Also assigns every tab made before accounts existed to that administrator,
// and removes sessions from the old single-password sign-in.
// Runs with Node's built-in TypeScript support and reads .env.local.
import { randomBytes } from "node:crypto";
import { stderr, stdout } from "node:process";
import mongoose from "mongoose";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password.ts";
import { ask, readHidden } from "./prompt.ts";

const uri = process.env.MONGODB_URI;
if (!uri) {
  stderr.write("MONGODB_URI is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

const email = (await ask("Administrator email: ")).normalize("NFKC").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  stderr.write("That doesn't look like an email address.\n");
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
const db = mongoose.connection.db!;
const users = db.collection("users");
await users.createIndex({ email: 1 }, { unique: true });

const now = new Date();
const existing = await users.findOne({ email });
let userId: mongoose.Types.ObjectId;

if (existing) {
  await users.updateOne({ _id: existing._id }, { $set: { role: "admin", status: "active", updatedAt: now } });
  userId = existing._id as mongoose.Types.ObjectId;
  stdout.write(`\n${existing.name} (${email}) is now an administrator. Their password is unchanged.\n`);
} else {
  const name = (await ask("Your name: ")).replace(/\s+/g, " ").slice(0, 60);
  if (!name) {
    stderr.write("A name is required.\n");
    process.exit(1);
  }
  const password = await readHidden(`Password (at least ${MIN_PASSWORD_LENGTH} characters): `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    stderr.write(`Too short: use at least ${MIN_PASSWORD_LENGTH} characters.\n`);
    process.exit(1);
  }
  if ((await readHidden("Confirm password: ")) !== password) {
    stderr.write("Passwords do not match.\n");
    process.exit(1);
  }
  const result = await users.insertOne({
    email,
    name,
    passwordHash: await hashPassword(password),
    role: "admin",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  userId = result.insertedId as mongoose.Types.ObjectId;
  stdout.write(`\nCreated administrator ${name} (${email}).\n`);
}

const claimed = await db.collection("tabs").updateMany({ ownerId: { $exists: false } }, { $set: { ownerId: userId } });
if (claimed.modifiedCount > 0) stdout.write(`Assigned ${claimed.modifiedCount} existing tab(s) to this account.\n`);
const legacy = await db.collection("sessions").deleteMany({ userId: { $exists: false } });
if (legacy.deletedCount > 0) stdout.write(`Removed ${legacy.deletedCount} session(s) from the old single-password sign-in.\n`);

if (!process.env.AUTH_SECRET) {
  stdout.write(`\nAUTH_SECRET is not set. Add this line to .env.local, then restart the server:\n\n`);
  stdout.write(`AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`);
}

await mongoose.disconnect();
