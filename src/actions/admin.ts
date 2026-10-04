"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import { resetUserPassword, setUserRole, setUserStatus } from "@/lib/users/userService";
import { resetUserPasswordSchema, setUserRoleSchema, setUserStatusSchema } from "@/schemas/account";

/** Admin-only: userService checks the actor's role, so a regular user gets "not found". */
function revalidateUser(userId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/users/${userId}`);
}

export const setUserStatusAction = authedAction(setUserStatusSchema, async (input, { actor }) => {
  await setUserStatus(input, actor);
  revalidateUser(input.userId);
});

export const setUserRoleAction = authedAction(setUserRoleSchema, async (input, { actor }) => {
  await setUserRole(input, actor);
  revalidateUser(input.userId);
});

export const resetUserPasswordAction = authedAction(resetUserPasswordSchema, async (input, { actor }) => {
  await resetUserPassword(input, actor);
  revalidateUser(input.userId);
});
