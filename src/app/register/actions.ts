"use server";

import { redirect } from "next/navigation";
import { DomainError } from "@/lib/actions/result";
import { getRequestContext } from "@/lib/auth/requestContext";
import { startSession } from "@/lib/auth/session";
import { isRegistrationLocked, recordRegistration } from "@/lib/auth/throttleStore";
import { hashRegistrationKey } from "@/lib/auth/tokens";
import { getAuthEnv } from "@/lib/env";
import { registerUser } from "@/lib/users/userService";
import { registerSchema } from "@/schemas/account";

export type RegisterState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  values: { name: string; email: string };
};

/**
 * Open registration (D16): anyone who can reach the app can create a
 * regular account. Unauthenticated, so it is allow-listed in
 * tests/auth/actionsAreAuthed.test.ts. Each device may register a few
 * accounts before the same backoff as sign-in applies.
 */
export async function register(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };
  const values = {
    name: typeof raw.name === "string" ? raw.name.slice(0, 60) : "",
    email: typeof raw.email === "string" ? raw.email.slice(0, 254) : "",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".") || "form"] ??= issue.message;
    return { error: null, fieldErrors, values };
  }

  let env;
  try {
    env = getAuthEnv();
  } catch {
    return { error: "Accounts aren't set up on this server yet. See README → Accounts.", fieldErrors: {}, values };
  }

  try {
    const { clientAddress } = await getRequestContext();
    const key = hashRegistrationKey(clientAddress, env.AUTH_SECRET);
    if (await isRegistrationLocked(key)) {
      return { error: "Too many new accounts from this device. Try again later.", fieldErrors: {}, values };
    }
    await recordRegistration(key);
    const user = await registerUser(parsed.data);
    await startSession(user);
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: null, fieldErrors: error.fieldErrors ?? { form: error.message }, values };
    }
    console.error("[register] failed:", error instanceof Error ? error.message : error);
    return { error: "Something went wrong. Please try again.", fieldErrors: {}, values };
  }

  redirect("/");
}
