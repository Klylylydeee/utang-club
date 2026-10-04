"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import { createTab, setTabArchived, updateTabDetails } from "@/lib/tabs/tabService";
import { createTabSchema, setTabArchivedSchema, updateTabDetailsSchema } from "@/schemas/tab";

export const createTabAction = authedAction(createTabSchema, async (input, { actor }) => {
  const result = await createTab(input, actor);
  revalidatePath("/");
  return result;
});

export const updateTabDetailsAction = authedAction(updateTabDetailsSchema, async (input, { actor }) => {
  await updateTabDetails(input, actor);
  revalidatePath("/");
  revalidatePath(`/tabs/${input.tabId}`, "layout");
});

export const setTabArchivedAction = authedAction(setTabArchivedSchema, async (input, { actor }) => {
  await setTabArchived(input, actor);
  revalidatePath("/");
  revalidatePath(`/tabs/${input.tabId}`, "layout");
});
