import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthEnv } from "@/lib/env";
import { LOGIN_PATH, SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE, sessionCookieName } from "./constants";
import { getRequestContext } from "./requestContext";
import {
  createSessionRecord,
  deleteAllSessionRecords,
  deleteSessionRecord,
  findActiveSession,
  type ActiveSession,
} from "./sessionStore";
import { passwordFingerprint } from "./tokens";

function currentFingerprint(): string {
  return passwordFingerprint(getAuthEnv().AUTH_PASSWORD_HASH);
}

async function readSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_SECURE)?.value ?? jar.get(SESSION_COOKIE_PLAIN)?.value;
}

/** The current session, or null. This is the real security check (not the proxy). */
export async function getSession(): Promise<ActiveSession | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return findActiveSession(token, currentFingerprint());
}

/** For pages and layouts: sends unauthenticated visitors to the login page. */
export async function requireSession(): Promise<ActiveSession> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

/** Starts a fresh session (new token every login: no session fixation). */
export async function startSession(): Promise<void> {
  const { isHttps } = await getRequestContext();
  const { token, absoluteExpiresAt } = await createSessionRecord(currentFingerprint());
  const jar = await cookies();
  jar.set(sessionCookieName(isHttps), token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "strict",
    path: "/",
    expires: absoluteExpiresAt,
  });
}

/** Ends this device's session. */
export async function endSession(): Promise<void> {
  const token = await readSessionToken();
  if (token) await deleteSessionRecord(token);
  await clearSessionCookies();
}

/** Ends every session on every device. */
export async function endAllSessions(): Promise<void> {
  await deleteAllSessionRecords();
  await clearSessionCookies();
}

async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  const { isHttps } = await getRequestContext();
  if (jar.has(SESSION_COOKIE_PLAIN)) jar.delete(SESSION_COOKIE_PLAIN);
  if (isHttps && jar.has(SESSION_COOKIE_SECURE)) {
    jar.set(SESSION_COOKIE_SECURE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  }
}
