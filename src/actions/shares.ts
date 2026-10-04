"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authedAction } from "@/lib/auth/authedAction";
import { leaveTab, removeShare, shareTab, updateShare } from "@/lib/tabs/shareService";
import { leaveTabSchema, removeShareSchema, shareTabSchema, updateShareSchema } from "@/schemas/share";

/** Sharing changes what the owner's panel and the other person's tab list show. */
function revalidateSharing(tabId: string) {
  revalidatePath("/");
  revalidatePath(`/tabs/${tabId}`, "layout");
}

export const shareTabAction = authedAction(shareTabSchema, async (input, { actor }) => {
  const result = await shareTab(input, actor);
  revalidateSharing(input.tabId);
  return result;
});

export const updateShareAction = authedAction(updateShareSchema, async (input, { actor }) => {
  await updateShare(input, actor);
  revalidateSharing(input.tabId);
});

export const removeShareAction = authedAction(removeShareSchema, async (input, { actor }) => {
  await removeShare(input, actor);
  revalidateSharing(input.tabId);
});

export const leaveTabAction = authedAction(leaveTabSchema, async (input, { actor }) => {
  await leaveTab(input, actor);
  revalidatePath("/");
  // From the server: the page they are on is no longer theirs to render.
  redirect("/");
});
