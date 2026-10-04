"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import { createTab, setTabArchived, updateTabDetails } from "@/lib/tabs/tabService";
import { createTabSchema, setTabArchivedSchema, updateTabDetailsSchema } from "@/schemas/tab";

export const createTabAction = authedAction(createTabSchema, async (input) => {
  const result = await createTab(input);
  revalidatePath("/");
  return result;
});

export const updateTabDetailsAction = authedAction(updateTabDetailsSchema, async (input) => {
  await updateTabDetails(input);
  revalidatePath("/");
  revalidatePath(`/tabs/${input.tabId}`, "layout");
});

export const setTabArchivedAction = authedAction(setTabArchivedSchema, async (input) => {
  await setTabArchived(input);
  revalidatePath("/");
  revalidatePath(`/tabs/${input.tabId}`, "layout");
});
