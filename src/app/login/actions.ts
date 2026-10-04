"use server";

import { redirect } from "next/navigation";
import { burnPasswordCheck, MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { getRequestContext } from "@/lib/auth/requestContext";
import { startSession } from "@/lib/auth/session";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/lib/auth/throttleStore";
import { hashAccountKey, hashClientKey } from "@/lib/auth/tokens";
import { getAuthEnv } from "@/lib/env";
import { findUserForSignIn } from "@/lib/users/userService";
import { normalizeEmail } from "@/schemas/account";

export type LoginState = { error: string | null; email: string };

// One message for every failure, so responses never reveal whether the
// email exists, the password was wrong, or the device/account is locked out.
const GENERIC_FAILURE = "That email and password don't match. Check them and try again in a moment.";

/**
 * Unauthenticated Server Action (allow-listed in
 * tests/auth/actionsAreAuthed.test.ts). Works without JavaScript too.
 * Throttled per device and per account; every failure costs the same
 * scrypt time, whether or not the account exists.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const password = formData.get("password");
  const next = safeNextPath(formData.get("next"));
  const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail).slice(0, 254) : "";
  if (!email) return { error: "Enter your email.", email };
  if (typeof password !== "string" || password.length === 0) return { error: "Enter your password.", email };
  if (password.length > MAX_PASSWORD_LENGTH) return { error: GENERIC_FAILURE, email };

  let env;
  try {
    env = getAuthEnv();
  } catch {
    return { error: "Sign-in isn't set up on this server yet. See README → Accounts.", email };
  }

  const { clientAddress } = await getRequestContext();
  const keys = [hashClientKey(clientAddress, env.AUTH_SECRET), hashAccountKey(email, env.AUTH_SECRET)];

  let user;
  try {
    const locked = await isLoginLocked(keys);
    user = locked ? null : await findUserForSignIn(email);
    let valid = false;
    if (user) valid = await verifyPassword(password, user.passwordHash);
    else await burnPasswordCheck(password); // same cost as a real check

    if (!valid || !user) {
      if (!locked) await recordLoginFailure(keys);
      return { error: GENERIC_FAILURE, email };
    }
    // Only someone with the right password learns the account is disabled.
    if (user.status !== "active") {
      return { error: "This account is disabled. Ask your administrator to turn it back on.", email };
    }

    await clearLoginFailures(keys);
    await startSession(user);
  } catch (error) {
    console.error("[login] failed:", error instanceof Error ? error.message : error);
    return { error: "Something went wrong. Please try again.", email };
  }

  redirect(next);
}
