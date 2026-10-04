import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_IDLE_TIMEOUT_MS, SESSION_TOUCH_INTERVAL_MS } from "@/lib/auth/constants";
import {
  createSessionRecord,
  deleteSessionRecord,
  deleteUserSessions,
  findActiveSession,
} from "@/lib/auth/sessionStore";
import {
  clearLoginFailures,
  isLoginLocked,
  isRegistrationLocked,
  recordLoginFailure,
  recordRegistration,
} from "@/lib/auth/throttleStore";
import { hashSessionToken } from "@/lib/auth/tokens";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { startTestDatabase } from "../support/mongo";
import { createTestUser } from "../support/users";

let db: Awaited<ReturnType<typeof startTestDatabase>>;

beforeAll(async () => {
  db = await startTestDatabase("auth-test");
});
beforeEach(async () => {
  await db.clear();
});
afterAll(async () => {
  await db?.stop();
});

const DAY = 24 * 60 * 60 * 1000;

describe("session store", () => {
  it("stores only a hash of the token, tied to the user", async () => {
    const user = await createTestUser();
    const { token } = await createSessionRecord(user);
    const stored = await Session.findOne().lean();
    expect(stored?.tokenHash).toBe(hashSessionToken(token));
    expect(stored?.userId.toString()).toBe(user.id);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("resolves a live token to its session and user", async () => {
    const user = await createTestUser("admin", "Klyde");
    const { token } = await createSessionRecord(user);
    await expect(findActiveSession(token)).resolves.toMatchObject({
      user: { id: user.id, name: "Klyde", role: "admin" },
    });
    await expect(findActiveSession("not-a-real-token")).resolves.toBeNull();
    await expect(findActiveSession("")).resolves.toBeNull();
  });

  it("ends sessions when the user's password changes", async () => {
    const user = await createTestUser();
    const { token } = await createSessionRecord(user);
    await User.updateOne({ _id: user.id }, { $set: { passwordHash: `${user.passwordHash}x` } });
    await expect(findActiveSession(token)).resolves.toBeNull();
    expect(await Session.countDocuments()).toBe(0);
  });

  it("ends sessions of disabled or deleted users", async () => {
    const disabled = await createTestUser();
    const deleted = await createTestUser();
    const a = await createSessionRecord(disabled);
    const b = await createSessionRecord(deleted);
    await User.updateOne({ _id: disabled.id }, { $set: { status: "disabled" } });
    await User.deleteOne({ _id: deleted.id });
    await expect(findActiveSession(a.token)).resolves.toBeNull();
    await expect(findActiveSession(b.token)).resolves.toBeNull();
  });

  it("rejects pre-accounts sessions that have no user", async () => {
    const tokenHash = hashSessionToken("legacy-token");
    const now = new Date();
    await Session.collection.insertOne({
      tokenHash,
      passwordFingerprint: "fp",
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + DAY),
      absoluteExpiresAt: new Date(now.getTime() + DAY),
    });
    await expect(findActiveSession("legacy-token")).resolves.toBeNull();
  });

  it("expires after 7 idle days", async () => {
    const user = await createTestUser();
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSessionRecord(user, start);
    await expect(findActiveSession(token, new Date(start.getTime() + SESSION_IDLE_TIMEOUT_MS - 1))).resolves.not.toBeNull();

    const { token: idle } = await createSessionRecord(user, start);
    await expect(findActiveSession(idle, new Date(start.getTime() + SESSION_IDLE_TIMEOUT_MS + 1))).resolves.toBeNull();
  });

  it("slides the idle expiry on use, but never past 30 days", async () => {
    const user = await createTestUser();
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSessionRecord(user, start);
    for (const day of [6, 12, 18, 24, 29]) {
      await expect(findActiveSession(token, new Date(start.getTime() + day * DAY)), `day ${day}`).resolves.not.toBeNull();
    }
    await expect(findActiveSession(token, new Date(start.getTime() + 30 * DAY))).resolves.toBeNull();
  });

  it("only writes lastSeenAt once per touch interval", async () => {
    const user = await createTestUser();
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSessionRecord(user, start);
    await findActiveSession(token, new Date(start.getTime() + SESSION_TOUCH_INTERVAL_MS / 2));
    expect((await Session.findOne().lean())?.lastSeenAt).toEqual(start);
    const later = new Date(start.getTime() + SESSION_TOUCH_INTERVAL_MS);
    await findActiveSession(token, later);
    expect((await Session.findOne().lean())?.lastSeenAt).toEqual(later);
  });

  it("sign out ends one session; sign out everywhere ends only that user's", async () => {
    const me = await createTestUser();
    const other = await createTestUser();
    const a = await createSessionRecord(me);
    const b = await createSessionRecord(me);
    const theirs = await createSessionRecord(other);
    await deleteSessionRecord(a.token);
    await expect(findActiveSession(a.token)).resolves.toBeNull();
    await expect(findActiveSession(b.token)).resolves.not.toBeNull();
    await deleteUserSessions(me.id);
    await expect(findActiveSession(b.token)).resolves.toBeNull();
    await expect(findActiveSession(theirs.token)).resolves.not.toBeNull();
  });

  it("issues a different token every sign-in", async () => {
    const user = await createTestUser();
    const a = await createSessionRecord(user);
    const b = await createSessionRecord(user);
    expect(a.token).not.toBe(b.token);
  });
});

describe("sign-in throttle store", () => {
  const now = new Date("2026-10-03T00:00:00Z");

  it("locks a device after 5 failures and leaves other devices alone", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure(["device-a"], now);
    expect(await isLoginLocked(["device-a"], now)).toBe(false);
    await recordLoginFailure(["device-a"], now);
    expect(await isLoginLocked(["device-a"], now)).toBe(true);
    expect(await isLoginLocked(["device-b"], now)).toBe(false);
  });

  it("locks an account after 5 failures from different devices", async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure([`device-${i}`, "account-bea"], now);
    expect(await isLoginLocked(["fresh-device", "account-bea"], now)).toBe(true);
    expect(await isLoginLocked(["fresh-device", "account-dave"], now)).toBe(false);
  });

  it("locks everyone after 20 failures spread across devices (distributed guessing)", async () => {
    for (let i = 0; i < 20; i++) await recordLoginFailure([`device-${i}`], now);
    expect(await isLoginLocked(["brand-new-device"], now)).toBe(true);
  });

  it("a successful sign-in clears those keys' failures", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure(["device-a", "account-a"], now);
    await clearLoginFailures(["device-a", "account-a"]);
    await recordLoginFailure(["device-a", "account-a"], now);
    expect(await isLoginLocked(["device-a", "account-a"], now)).toBe(false);
  });

  it("registration has its own budget that doesn't touch sign-in", async () => {
    for (let i = 0; i < 5; i++) await recordRegistration("register-device-a", now);
    expect(await isRegistrationLocked("register-device-a", now)).toBe(true);
    expect(await isRegistrationLocked("register-device-b", now)).toBe(false);
    expect(await isLoginLocked(["device-a"], now)).toBe(false);
  });
});
