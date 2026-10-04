"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import { addPerson, deletePerson, renamePerson } from "@/lib/tabs/tabService";
import { personDeleteSchema, personInputSchema, personUpdateSchema } from "@/schemas/person";

/** People live inside a tab; refresh that tab's pages and the tab list counts. */
function revalidateTab(tabId: string) {
  revalidatePath("/");
  revalidatePath(`/tabs/${tabId}`, "layout");
}

export const addPersonAction = authedAction(personInputSchema, async (input) => {
  const result = await addPerson(input);
  revalidateTab(input.tabId);
  return result;
});

export const renamePersonAction = authedAction(personUpdateSchema, async (input) => {
  const { tabId } = await renamePerson(input);
  revalidateTab(tabId);
});

export const deletePersonAction = authedAction(personDeleteSchema, async (input) => {
  const { tabId } = await deletePerson(input);
  revalidateTab(tabId);
});
