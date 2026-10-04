import "server-only";
import mongoose, { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import { connectToDatabase } from "@/lib/db/connect";
import { loadWritableTab, touchTab } from "@/lib/tabs/tabService";
import { Person } from "@/models/Person";
import { Transaction } from "@/models/Transaction";
import type { TransactionInput, TransactionRef, TransactionUpdate } from "@/schemas/transaction";
import type { TransactionRow } from "./types";

/**
 * Transaction rows inside a tab. Inputs are already Zod-validated. Every
 * write checks the tab is writable (D6) and that both people belong to it.
 * Rows are never changed or removed except by an explicit user edit or
 * delete; a zero balance never touches history.
 */

type TransactionDoc = {
  _id: Types.ObjectId;
  tabId: Types.ObjectId;
  type: TransactionRow["type"];
  description: string;
  foreignCurrency?: string | null;
  foreignAmountMinor?: number | null;
  amountPhpCentavos: number;
  payerId: Types.ObjectId;
  recipientId: Types.ObjectId;
  transactionDate?: Date | null;
  notes?: string | null;
  createdAt: Date;
};

const NOT_FOUND_MESSAGE = "This transaction no longer exists.";

function toRow(doc: TransactionDoc): TransactionRow {
  return {
    id: doc._id.toString(),
    type: doc.type,
    description: doc.description,
    foreignCurrency: doc.foreignCurrency ?? null,
    foreignAmountMinor: doc.foreignAmountMinor ?? null,
    amountPhpCentavos: doc.amountPhpCentavos,
    payerId: doc.payerId.toString(),
    recipientId: doc.recipientId.toString(),
    transactionDate: doc.transactionDate ? doc.transactionDate.toISOString().slice(0, 10) : null,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** A tab's rows in entry order, like the spreadsheet they replace. */
export async function listTransactions(tabId: string): Promise<TransactionRow[]> {
  await connectToDatabase();
  const docs = await Transaction.find({ tabId: new Types.ObjectId(tabId) })
    .sort({ createdAt: 1, _id: 1 })
    .lean<TransactionDoc[]>();
  return docs.map(toRow);
}

export async function createTransaction(input: TransactionInput): Promise<TransactionRow> {
  await connectToDatabase();
  const tab = await loadWritableTab(input.tabId);
  await assertParticipants(tab._id, input);
  const doc = await Transaction.create({ ...persistedFields(input), tabId: tab._id });
  await touchTab(tab._id);
  return toRow(doc.toObject<TransactionDoc>());
}

/** Replaces every editable field. A row can't be moved to another tab. */
export async function updateTransaction(input: TransactionUpdate): Promise<TransactionRow> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId);
  if (!existing.tabId.equals(input.tabId)) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  const tab = await loadWritableTab(input.tabId);
  await assertParticipants(tab._id, input);

  const fields = persistedFields(input);
  const unset = Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value === undefined)
      .map(([key]) => [key, 1]),
  );
  const set = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

  const doc = await Transaction.findOneAndUpdate(
    { _id: existing._id, tabId: tab._id },
    Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
    { returnDocument: "after", runValidators: true },
  ).lean<TransactionDoc>();
  if (!doc) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  await touchTab(tab._id);
  return toRow(doc);
}

export async function deleteTransaction(input: TransactionRef): Promise<{ tabId: string }> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId);
  await loadWritableTab(existing.tabId.toString());
  await Transaction.deleteOne({ _id: existing._id });
  await touchTab(existing.tabId);
  return { tabId: existing.tabId.toString() };
}

/** Copies a row's saved values into a new row at the end of the tab. */
export async function duplicateTransaction(input: TransactionRef): Promise<TransactionRow & { tabId: string }> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId);
  await loadWritableTab(existing.tabId.toString());
  const doc = await Transaction.create({
    tabId: existing.tabId,
    type: existing.type,
    description: existing.description,
    foreignCurrency: existing.foreignCurrency ?? undefined,
    foreignAmountMinor: existing.foreignAmountMinor ?? undefined,
    amountPhpCentavos: existing.amountPhpCentavos,
    payerId: existing.payerId,
    recipientId: existing.recipientId,
    transactionDate: existing.transactionDate ?? undefined,
    notes: existing.notes ?? undefined,
  });
  await touchTab(existing.tabId);
  return { ...toRow(doc.toObject<TransactionDoc>()), tabId: existing.tabId.toString() };
}

/** The validated input mapped to model fields; undefined means "not set". */
function persistedFields(input: TransactionInput) {
  return {
    type: input.type,
    description: input.description,
    foreignCurrency: input.foreignCurrency,
    foreignAmountMinor: input.foreignAmountMinor,
    amountPhpCentavos: input.amountPhpCentavos,
    payerId: new Types.ObjectId(input.payerId),
    recipientId: new Types.ObjectId(input.recipientId),
    transactionDate: input.transactionDate ? new Date(`${input.transactionDate}T00:00:00.000Z`) : undefined,
    notes: input.notes,
  };
}

async function loadTransaction(transactionId: string) {
  const doc = await Transaction.findById(new Types.ObjectId(transactionId)).lean<TransactionDoc>();
  if (!doc) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  return doc;
}

/** Both people must exist in this tab; ids from another tab are rejected per field. */
async function assertParticipants(tabId: Types.ObjectId, input: Pick<TransactionInput, "payerId" | "recipientId">) {
  const found = await Person.find(
    {
      tabId,
      // Our own operator on validated ids; trusted() exempts it from sanitizeFilter.
      _id: mongoose.trusted({ $in: [new Types.ObjectId(input.payerId), new Types.ObjectId(input.recipientId)] }),
    },
    { _id: 1 },
  ).lean();
  const ids = new Set(found.map((person) => person._id.toString()));
  const fieldErrors: Record<string, string> = {};
  if (!ids.has(input.payerId)) fieldErrors.payerId = "Choose someone in this tab";
  if (!ids.has(input.recipientId)) fieldErrors.recipientId = "Choose someone in this tab";
  if (Object.keys(fieldErrors).length > 0) {
    throw new DomainError("validation", "Pick people from this tab.", fieldErrors);
  }
}
