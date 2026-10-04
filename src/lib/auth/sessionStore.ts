import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { Session } from "@/models/Session";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS, SESSION_TOUCH_INTERVAL_MS } from "./constants";
import { generateSessionToken, hashSessionToken } from "./tokens";

export type ActiveSession = {
  id: string;
  absoluteExpiresAt: Date;
};

/** Creates a session and returns the raw token for the cookie. */
export async function createSessionRecord(
  fingerprint: string,
  now = new Date(),
): Promise<{ token: string; absoluteExpiresAt: Date }> {
  await connectToDatabase();
  const token = generateSessionToken();
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS);
  await Session.create({
    tokenHash: hashSessionToken(token),
    passwordFingerprint: fingerprint,
    lastSeenAt: now,
    expiresAt: new Date(Math.min(now.getTime() + SESSION_IDLE_TIMEOUT_MS, absoluteExpiresAt.getTime())),
    absoluteExpiresAt,
  });
  return { token, absoluteExpiresAt };
}

/**
 * Looks up a session by raw token. Rejects expired sessions and sessions
 * created under a different owner password; slides the idle expiry.
 */
export async function findActiveSession(
  token: string,
  fingerprint: string,
  now = new Date(),
): Promise<ActiveSession | null> {
  if (!token || token.length > 128) return null;
  await connectToDatabase();
  const tokenHash = hashSessionToken(token);
  const session = await Session.findOne({ tokenHash }).lean();
  if (!session) return null;

  const expired =
    session.expiresAt.getTime() <= now.getTime() || session.absoluteExpiresAt.getTime() <= now.getTime();
  if (expired || session.passwordFingerprint !== fingerprint) {
    await Session.deleteOne({ tokenHash });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
    await Session.updateOne(
      { tokenHash },
      {
        $set: {
          lastSeenAt: now,
          expiresAt: new Date(
            Math.min(now.getTime() + SESSION_IDLE_TIMEOUT_MS, session.absoluteExpiresAt.getTime()),
          ),
        },
      },
    );
  }

  return { id: session._id.toString(), absoluteExpiresAt: session.absoluteExpiresAt };
}

export async function deleteSessionRecord(token: string): Promise<void> {
  if (!token) return;
  await connectToDatabase();
  await Session.deleteOne({ tokenHash: hashSessionToken(token) });
}

export async function deleteAllSessionRecords(): Promise<void> {
  await connectToDatabase();
  await Session.deleteMany({});
}
