import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { LoginThrottle } from "@/models/LoginThrottle";
import {
  CLIENT_POLICY,
  GLOBAL_POLICY,
  GLOBAL_THROTTLE_KEY,
  THROTTLE_RETENTION_MS,
  isLocked,
  registerFailure,
  type ThrottleState,
} from "./throttlePolicy";

async function load(key: string): Promise<ThrottleState | null> {
  const record = await LoginThrottle.findOne({ key }).lean();
  if (!record) return null;
  return {
    windowStartedAt: record.windowStartedAt,
    failures: record.failures,
    lockedUntil: record.lockedUntil ?? null,
    lockCount: record.lockCount,
  };
}

/**
 * True when any of these keys (the device, the account being signed into)
 * or sign-ins as a whole are locked out.
 */
export async function isLoginLocked(keys: readonly string[], now = new Date()): Promise<boolean> {
  await connectToDatabase();
  const states = await Promise.all([...keys, GLOBAL_THROTTLE_KEY].map(load));
  return states.some((state) => isLocked(state, now));
}

/** Counts one failed sign-in against each key and the global budget. */
export async function recordLoginFailure(keys: readonly string[], now = new Date()): Promise<void> {
  await connectToDatabase();
  await Promise.all([
    ...keys.map((key) => update(key, now, CLIENT_POLICY)),
    update(GLOBAL_THROTTLE_KEY, now, GLOBAL_POLICY),
  ]);
}

/** A successful sign-in clears these keys' failures (not the global count). */
export async function clearLoginFailures(keys: readonly string[]): Promise<void> {
  await connectToDatabase();
  // Our own operator on server-made keys; trusted() exempts it from sanitizeFilter.
  await LoginThrottle.deleteMany({ key: mongoose.trusted({ $in: [...keys] }) });
}

/**
 * Registration has its own budget per device (same backoff as sign-in), so
 * scripted sign-ups are slowed without touching the sign-in budget.
 */
export async function isRegistrationLocked(key: string, now = new Date()): Promise<boolean> {
  await connectToDatabase();
  return isLocked(await load(key), now);
}

export async function recordRegistration(key: string, now = new Date()): Promise<void> {
  await connectToDatabase();
  await update(key, now, CLIENT_POLICY);
}

async function update(key: string, now: Date, policy: typeof CLIENT_POLICY): Promise<void> {
  const next = registerFailure(await load(key), now, policy);
  await LoginThrottle.updateOne(
    { key },
    { $set: { ...next, expiresAt: new Date(now.getTime() + THROTTLE_RETENTION_MS) } },
    { upsert: true },
  );
}
