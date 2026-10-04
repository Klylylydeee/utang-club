import "server-only";
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

/** True when this client, or logins as a whole, are currently locked out. */
export async function isLoginLocked(clientKey: string, now = new Date()): Promise<boolean> {
  await connectToDatabase();
  const [client, global] = await Promise.all([load(clientKey), load(GLOBAL_THROTTLE_KEY)]);
  return isLocked(client, now) || isLocked(global, now);
}

/** Counts one failed attempt against both the client and the global budget. */
export async function recordLoginFailure(clientKey: string, now = new Date()): Promise<void> {
  await connectToDatabase();
  await Promise.all([
    update(clientKey, now, CLIENT_POLICY),
    update(GLOBAL_THROTTLE_KEY, now, GLOBAL_POLICY),
  ]);
}

/** A successful login clears this client's failures (not the global count). */
export async function clearLoginFailures(clientKey: string): Promise<void> {
  await connectToDatabase();
  await LoginThrottle.deleteOne({ key: clientKey });
}

async function update(key: string, now: Date, policy: typeof CLIENT_POLICY): Promise<void> {
  const next = registerFailure(await load(key), now, policy);
  await LoginThrottle.updateOne(
    { key },
    { $set: { ...next, expiresAt: new Date(now.getTime() + THROTTLE_RETENTION_MS) } },
    { upsert: true },
  );
}
