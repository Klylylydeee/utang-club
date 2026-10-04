import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { LOGIN_PATH, SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE, sessionCookieName } from "./constants";
import { getRequestContext } from "./requestContext";
import {
  createSessionRecord,
  deleteSessionRecord,
  findActiveSession,
  type ActiveSession,
} from "./sessionStore";

async function readSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_SECURE)?.value ?? jar.get(SESSION_COOKIE_PLAIN)?.value;
}

/**
 * The current session and its user, or null. This is the real security
 * check (not the proxy). Cached per request so a page and its layouts
 * share one lookup.
 */
export const getSession = cache(async (): Promise<ActiveSession | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return findActiveSession(token);
});

/** For pages and layouts: sends signed-out visitors to the sign-in page. */
export async function requireSession(): Promise<ActiveSession> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

/** For admin pages: anyone else gets a 404, so the area isn't advertised. */
export async function requireAdmin(): Promise<ActiveSession> {
  const session = await requireSession();
  if (session.user.role !== "admin") notFound();
  return session;
}

/** Starts a fresh session for a user (a new token every sign-in: no session fixation). */
export async function startSession(user: { id: string; passwordHash: string }): Promise<void> {
  const { isHttps } = await getRequestContext();
  const { token, absoluteExpiresAt } = await createSessionRecord(user);
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


async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  const { isHttps } = await getRequestContext();
  if (jar.has(SESSION_COOKIE_PLAIN)) jar.delete(SESSION_COOKIE_PLAIN);
  if (isHttps && jar.has(SESSION_COOKIE_SECURE)) {
    jar.set(SESSION_COOKIE_SECURE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  }
}
