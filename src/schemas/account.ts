import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordRules";
import { objectIdSchema, requiredText } from "./common";

/** Canonical form for sign-in and uniqueness: trimmed, NFKC, lowercase. */
export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export const emailField = z
  .string({ error: "Enter your email" })
  .transform(normalizeEmail)
  .pipe(z.string().min(1, "Enter your email").max(254, "That email is too long").pipe(z.email("Enter a valid email")));

export const newPasswordField = z
  .string({ error: "Choose a password" })
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, "That password is too long");

export const registerSchema = z
  .object({
    name: requiredText("Name", 60),
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string({ error: "Type the password again" }),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match",
  });

export type RegisterInput = z.output<typeof registerSchema>;

// --- Admin user management (D17) ---

export const userRefSchema = z.object({ userId: objectIdSchema });

export const setUserStatusSchema = z.object({ userId: objectIdSchema, status: z.enum(["active", "disabled"]) });

export const setUserRoleSchema = z.object({ userId: objectIdSchema, role: z.enum(["user", "admin"]) });

export const resetUserPasswordSchema = z.object({ userId: objectIdSchema, password: newPasswordField });

export type SetUserStatusInput = z.output<typeof setUserStatusSchema>;
export type SetUserRoleInput = z.output<typeof setUserRoleSchema>;
export type ResetUserPasswordInput = z.output<typeof resetUserPasswordSchema>;
