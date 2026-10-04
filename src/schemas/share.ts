import { z } from "zod";
import { normalizeEmail } from "./account";
import { objectIdSchema } from "./common";

export const shareRoleSchema = z.enum(["viewer", "editor"], { error: "Choose view or edit" });
export type ShareRole = z.infer<typeof shareRoleSchema>;

/** The friend's email, normalized the same way as sign-in. */
const friendEmailField = z
  .string({ error: "Enter their email" })
  .transform(normalizeEmail)
  .pipe(z.string().min(1, "Enter their email").max(254, "That email is too long").pipe(z.email("Enter a valid email")));

export const shareTabSchema = z.object({
  tabId: objectIdSchema,
  email: friendEmailField,
  role: shareRoleSchema,
});
export type ShareTabInput = z.infer<typeof shareTabSchema>;

export const updateShareSchema = z.object({
  tabId: objectIdSchema,
  userId: objectIdSchema,
  role: shareRoleSchema,
});
export type UpdateShareInput = z.infer<typeof updateShareSchema>;

export const removeShareSchema = z.object({
  tabId: objectIdSchema,
  userId: objectIdSchema,
});
export type RemoveShareInput = z.infer<typeof removeShareSchema>;

export const leaveTabSchema = z.object({ tabId: objectIdSchema });
export type LeaveTabInput = z.infer<typeof leaveTabSchema>;
