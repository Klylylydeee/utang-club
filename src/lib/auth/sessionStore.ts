import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import type { SessionUser, UserRole } from "./actor";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS, SESSION_TOUCH_INTERVAL_MS } from "./constants";
import { generateSessionToken, hashSessionToken, passwordFingerprint } from "./tokens";

export type ActiveSession = {
  id: string;
  absoluteExpiresAt: Date;
  user: SessionUser;
};

/** Creates a session for a user and returns the raw token for the cookie. */
export async function createSessionRecord(
  user: { id: string; passwordHash: string },
  now = new Date(),
): Promise<{ token: string; absoluteExpiresAt: Date }> {
  await connectToDatabase();
  const token = generateSessionToken();
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS);
  await Session.create({
    userId: new Types.ObjectId(user.id),
    tokenHash: hashSessionToken(token),
    passwordFingerprint: passwordFingerprint(user.passwordHash),
    lastSeenAt: now,
    expiresAt: new Date(Math.min(now.getTime() + SESSION_IDLE_TIMEOUT_MS, absoluteExpiresAt.getTime())),
    absoluteExpiresAt,
  });
  return { token, absoluteExpiresAt };
}

/**
 * Looks up a session by raw token. Rejects (and deletes) sessions that are
 * expired, belong to a missing or disabled user, or were created under a
 * password that has since changed. Slides the idle expiry.
 */
export async function findActiveSession(token: string, now = new Date()): Promise<ActiveSession | null> {
  if (!token || token.length > 128) return null;
  await connectToDatabase();
  const tokenHash = hashSessionToken(token);
  const session = await Session.findOne({ tokenHash }).lean();
  if (!session) return null;

  const user = session.userId
    ? await User.findById(session.userId, { email: 1, name: 1, role: 1, status: 1, passwordHash: 1 }).lean()
    : null;
  const expired =
    session.expiresAt.getTime() <= now.getTime() || session.absoluteExpiresAt.getTime() <= now.getTime();
  if (
    expired ||
    !user ||
    user.status !== "active" ||
    session.passwordFingerprint !== passwordFingerprint(user.passwordHash)
  ) {
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

  return {
    id: session._id.toString(),
    absoluteExpiresAt: session.absoluteExpiresAt,
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role as UserRole },
  };
}

export async function deleteSessionRecord(token: string): Promise<void> {
  if (!token) return;
  await connectToDatabase();
  await Session.deleteOne({ tokenHash: hashSessionToken(token) });
}

/** Signs one user out everywhere (their own "sign out on all devices", or an admin action). */
export async function deleteUserSessions(userId: string): Promise<void> {
  await connectToDatabase();
  await Session.deleteMany({ userId: new Types.ObjectId(userId) });
}
