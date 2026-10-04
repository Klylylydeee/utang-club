"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import {
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  updateTransaction,
} from "@/lib/transactions/transactionService";
import { transactionInputSchema, transactionRefSchema, transactionUpdateSchema } from "@/schemas/transaction";

/** Rows feed the tab's counts, its settlements and the tab list. */
function revalidateTab(tabId: string) {
  revalidatePath("/");
  revalidatePath(`/tabs/${tabId}`, "layout");
}

export const createTransactionAction = authedAction(transactionInputSchema, async (input) => {
  const row = await createTransaction(input);
  revalidateTab(input.tabId);
  return row;
});

export const updateTransactionAction = authedAction(transactionUpdateSchema, async (input) => {
  const row = await updateTransaction(input);
  revalidateTab(input.tabId);
  return row;
});

export const deleteTransactionAction = authedAction(transactionRefSchema, async (input) => {
  const { tabId } = await deleteTransaction(input);
  revalidateTab(tabId);
});

export const duplicateTransactionAction = authedAction(transactionRefSchema, async (input) => {
  const { tabId, ...row } = await duplicateTransaction(input);
  revalidateTab(tabId);
  return row;
});
