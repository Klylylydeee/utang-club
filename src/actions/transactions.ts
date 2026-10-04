"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import {
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  restoreTransaction,
  updateTransaction,
} from "@/lib/transactions/transactionService";
import { splitExpense } from "@/lib/transactions/splitService";
import { splitExpenseSchema } from "@/schemas/split";
import { transactionInputSchema, transactionRefSchema, transactionUpdateSchema } from "@/schemas/transaction";

/** Rows feed the tab's counts, its settlements and the tab list. */
function revalidateTab(tabId: string) {
  revalidatePath("/");
  revalidatePath(`/tabs/${tabId}`, "layout");
}

export const createTransactionAction = authedAction(transactionInputSchema, async (input, { actor }) => {
  const row = await createTransaction(input, actor);
  revalidateTab(input.tabId);
  return row;
});

export const updateTransactionAction = authedAction(transactionUpdateSchema, async (input, { actor }) => {
  const row = await updateTransaction(input, actor);
  revalidateTab(input.tabId);
  return row;
});

export const deleteTransactionAction = authedAction(transactionRefSchema, async (input, { actor }) => {
  const { tabId } = await deleteTransaction(input, actor);
  revalidateTab(tabId);
});

export const restoreTransactionAction = authedAction(transactionRefSchema, async (input, { actor }) => {
  const { tabId } = await restoreTransaction(input, actor);
  revalidateTab(tabId);
});

export const duplicateTransactionAction = authedAction(transactionRefSchema, async (input, { actor }) => {
  const { tabId, ...row } = await duplicateTransaction(input, actor);
  revalidateTab(tabId);
  return row;
});

export const splitExpenseAction = authedAction(splitExpenseSchema, async (input, { actor }) => {
  const result = await splitExpense(input, actor);
  revalidateTab(input.tabId);
  return result;
});
