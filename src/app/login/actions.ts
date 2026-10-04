"use server";

import { redirect } from "next/navigation";
import { burnPasswordCheck, MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { getRequestContext } from "@/lib/auth/requestContext";
import { startSession } from "@/lib/auth/session";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/lib/auth/throttleStore";
import { hashClientKey } from "@/lib/auth/tokens";
import { getAuthEnv } from "@/lib/env";

export type LoginState = { error: string | null };

// One message for every failure, so responses never reveal whether the
// password was wrong, the client is locked out, or attempts remain.
const GENERIC_FAILURE = "That didn't work. Check the password and try again in a moment.";

/**
 * The single unauthenticated Server Action (allow-listed in
 * tests/auth/actionsAreAuthed.test.ts). Works without JavaScript too.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const next = safeNextPath(formData.get("next"));
  if (typeof password !== "string" || password.length === 0) return { error: "Enter the password." };
  if (password.length > MAX_PASSWORD_LENGTH) return { error: GENERIC_FAILURE };

  let env;
  try {
    env = getAuthEnv();
  } catch {
    return { error: "Sign-in isn't set up yet. See README → Sign-in." };
  }

  const { clientAddress } = await getRequestContext();
  const clientKey = hashClientKey(clientAddress, env.AUTH_SECRET);

  try {
    const locked = await isLoginLocked(clientKey);
    let valid = false;
    if (locked) {
      await burnPasswordCheck(password); // same cost as a real check
    } else {
      valid = await verifyPassword(password, env.AUTH_PASSWORD_HASH);
    }

    if (!valid) {
      if (!locked) await recordLoginFailure(clientKey);
      return { error: GENERIC_FAILURE };
    }

    await clearLoginFailures(clientKey);
    await startSession();
  } catch (error) {
    console.error("[login] failed:", error instanceof Error ? error.message : error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect(next);
}
