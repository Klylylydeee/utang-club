import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_IDLE_TIMEOUT_MS, SESSION_TOUCH_INTERVAL_MS } from "@/lib/auth/constants";
import {
  createSessionRecord,
  deleteAllSessionRecords,
  deleteSessionRecord,
  findActiveSession,
} from "@/lib/auth/sessionStore";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/lib/auth/throttleStore";
import { hashSessionToken } from "@/lib/auth/tokens";
import { Session } from "@/models/Session";
import { startTestDatabase } from "../support/mongo";

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

const FINGERPRINT = "fp-current";
const DAY = 24 * 60 * 60 * 1000;

describe("session store", () => {
  it("stores only a hash of the token", async () => {
    const { token } = await createSessionRecord(FINGERPRINT);
    const stored = await Session.findOne().lean();
    expect(stored?.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("finds a live session by its token", async () => {
    const { token } = await createSessionRecord(FINGERPRINT);
    await expect(findActiveSession(token, FINGERPRINT)).resolves.not.toBeNull();
    await expect(findActiveSession("not-a-real-token", FINGERPRINT)).resolves.toBeNull();
    await expect(findActiveSession("", FINGERPRINT)).resolves.toBeNull();
  });

  it("rejects and deletes sessions from before a password change", async () => {
    const { token } = await createSessionRecord("fp-old-password");
    await expect(findActiveSession(token, FINGERPRINT)).resolves.toBeNull();
    expect(await Session.countDocuments()).toBe(0);
  });

  it("expires after 7 idle days", async () => {
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSessionRecord(FINGERPRINT, start);
    const justBefore = new Date(start.getTime() + SESSION_IDLE_TIMEOUT_MS - 1);
    await expect(findActiveSession(token, FINGERPRINT, justBefore)).resolves.not.toBeNull();

    const { token: idle } = await createSessionRecord(FINGERPRINT, start);
    const after = new Date(start.getTime() + SESSION_IDLE_TIMEOUT_MS + 1);
    await expect(findActiveSession(idle, FINGERPRINT, after)).resolves.toBeNull();
  });

  it("slides the idle expiry on use, but never past 30 days", async () => {
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSessionRecord(FINGERPRINT, start);

    // Use it every 6 days: stays alive thanks to sliding expiry...
    for (const day of [6, 12, 18, 24, 29]) {
      const now = new Date(start.getTime() + day * DAY);
      await expect(findActiveSession(token, FINGERPRINT, now), `day ${day}`).resolves.not.toBeNull();
    }
    // ...until the absolute 30-day limit.
    await expect(findActiveSession(token, FINGERPRINT, new Date(start.getTime() + 30 * DAY))).resolves.toBeNull();
  });

  it("only writes lastSeenAt once per touch interval", async () => {
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSessionRecord(FINGERPRINT, start);
    await findActiveSession(token, FINGERPRINT, new Date(start.getTime() + SESSION_TOUCH_INTERVAL_MS / 2));
    expect((await Session.findOne().lean())?.lastSeenAt).toEqual(start);
    const later = new Date(start.getTime() + SESSION_TOUCH_INTERVAL_MS);
    await findActiveSession(token, FINGERPRINT, later);
    expect((await Session.findOne().lean())?.lastSeenAt).toEqual(later);
  });

  it("logout revokes one session; logout-everywhere revokes all", async () => {
    const a = await createSessionRecord(FINGERPRINT);
    const b = await createSessionRecord(FINGERPRINT);
    await deleteSessionRecord(a.token);
    await expect(findActiveSession(a.token, FINGERPRINT)).resolves.toBeNull();
    await expect(findActiveSession(b.token, FINGERPRINT)).resolves.not.toBeNull();
    await deleteAllSessionRecords();
    await expect(findActiveSession(b.token, FINGERPRINT)).resolves.toBeNull();
  });

  it("issues a different token every login", async () => {
    const a = await createSessionRecord(FINGERPRINT);
    const b = await createSessionRecord(FINGERPRINT);
    expect(a.token).not.toBe(b.token);
  });
});

describe("login throttle store", () => {
  const now = new Date("2026-10-03T00:00:00Z");

  it("locks a client after 5 failures and leaves other clients alone", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure("client-a", now);
    expect(await isLoginLocked("client-a", now)).toBe(false);
    await recordLoginFailure("client-a", now);
    expect(await isLoginLocked("client-a", now)).toBe(true);
    expect(await isLoginLocked("client-b", now)).toBe(false);
  });

  it("locks everyone after 20 failures spread across clients (distributed guessing)", async () => {
    for (let i = 0; i < 20; i++) await recordLoginFailure(`client-${i}`, now);
    expect(await isLoginLocked("brand-new-client", now)).toBe(true);
  });

  it("a successful login clears that client's failures", async () => {
    for (let i = 0; i < 4; i++) await recordLoginFailure("client-a", now);
    await clearLoginFailures("client-a");
    await recordLoginFailure("client-a", now);
    expect(await isLoginLocked("client-a", now)).toBe(false);
  });
});
