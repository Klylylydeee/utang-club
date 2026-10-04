import "server-only";
import mongoose, { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import type { Actor } from "@/lib/auth/actor";
import { connectToDatabase } from "@/lib/db/connect";
import { loadReadableTab, loadWritableTab, touchTab } from "@/lib/tabs/tabService";
import { Person } from "@/models/Person";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import type { TransactionInput, TransactionRef, TransactionUpdate } from "@/schemas/transaction";
import type { DeletedTransactionRow, TransactionRow } from "./types";

/**
 * Transaction rows inside a tab. Inputs are already Zod-validated. Reads
 * need read access to the tab; every write needs the owner and an active
 * tab (D6, D15) and checks that both people belong to it.
 * Rows are never changed or removed except by an explicit user edit or
 * delete; a zero balance never touches history. Even a delete keeps the
 * row: it gets `deletedAt` and drops out of every list, total and
 * settlement, and can be restored.
 */

/** Matches live rows only. `null` also matches a missing field. */
export const LIVE = { deletedAt: null } as const;

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
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;
  createdAt: Date;
};

/** Account id → display name, for the authors of a set of rows. */
type AuthorNames = ReadonlyMap<string, string>;

const NOT_FOUND_MESSAGE = "This transaction no longer exists.";

function toRow(doc: TransactionDoc, authors: AuthorNames, actor: Actor): TransactionRow {
  const author = (id: Types.ObjectId | null | undefined) =>
    id ? { name: authors.get(id.toString()) ?? "A former account", isYou: id.equals(actor.userId) } : null;
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
    addedBy: author(doc.createdBy),
    editedBy: author(doc.updatedBy),
  };
}

/** Looks up the names of everyone who added or changed these rows, in one query. */
async function authorNames(docs: readonly TransactionDoc[]): Promise<AuthorNames> {
  const ids = new Map<string, Types.ObjectId>();
  for (const doc of docs) {
    for (const id of [doc.createdBy, doc.updatedBy, doc.deletedBy]) if (id) ids.set(id.toString(), id);
  }
  if (ids.size === 0) return new Map();
  const users = await User.find({ _id: mongoose.trusted({ $in: [...ids.values()] }) }, { name: 1 }).lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

/** Rows with their authors' names, for the given actor ("you"). */
export async function toRows(docs: TransactionDoc[], actor: Actor): Promise<TransactionRow[]> {
  const authors = await authorNames(docs);
  return docs.map((doc) => toRow(doc, authors, actor));
}

async function toSingleRow(doc: TransactionDoc, actor: Actor): Promise<TransactionRow> {
  return (await toRows([doc], actor))[0];
}

/** A tab's rows in entry order, like the spreadsheet they replace. */
export async function listTransactions(tabId: string, actor: Actor): Promise<TransactionRow[]> {
  await connectToDatabase();
  await loadReadableTab(tabId, actor);
  const docs = await Transaction.find({ tabId: new Types.ObjectId(tabId), ...LIVE })
    .sort({ createdAt: 1, _id: 1 })
    .lean<TransactionDoc[]>();
  return toRows(docs, actor);
}

/** A tab's deleted rows, most recently deleted first. Anyone who can read the tab may see them. */
export async function listDeletedTransactions(tabId: string, actor: Actor): Promise<DeletedTransactionRow[]> {
  await connectToDatabase();
  await loadReadableTab(tabId, actor);
  const docs = await Transaction.find({ tabId: new Types.ObjectId(tabId), deletedAt: mongoose.trusted({ $ne: null }) })
    .sort({ deletedAt: -1, _id: -1 })
    .lean<TransactionDoc[]>();
  const authors = await authorNames(docs);
  return docs.map((doc) => ({
    ...toRow(doc, authors, actor),
    deletedAt: (doc.deletedAt ?? doc.createdAt).toISOString(),
    deletedBy: doc.deletedBy
      ? { name: authors.get(doc.deletedBy.toString()) ?? "A former account", isYou: doc.deletedBy.equals(actor.userId) }
      : null,
  }));
}

export async function createTransaction(input: TransactionInput, actor: Actor): Promise<TransactionRow> {
  await connectToDatabase();
  const tab = await loadWritableTab(input.tabId, actor);
  await assertParticipants(tab._id, input);
  const doc = await Transaction.create({
    ...persistedFields(input),
    tabId: tab._id,
    createdBy: new Types.ObjectId(actor.userId),
  });
  await touchTab(tab._id);
  return toSingleRow(doc.toObject<TransactionDoc>(), actor);
}

/** Replaces every editable field. A row can't be moved to another tab. */
export async function updateTransaction(input: TransactionUpdate, actor: Actor): Promise<TransactionRow> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId);
  if (!existing.tabId.equals(input.tabId)) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  const tab = await loadWritableTab(input.tabId, actor);
  await assertParticipants(tab._id, input);

  const fields = persistedFields(input);
  // Saving a row without changing anything isn't an edit: leave it, and its author, alone.
  if (sameAsStored(existing, fields)) return toSingleRow(existing, actor);

  const unset = Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value === undefined)
      .map(([key]) => [key, 1]),
  );
  const set = {
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    updatedBy: new Types.ObjectId(actor.userId),
  };

  const doc = await Transaction.findOneAndUpdate(
    { _id: existing._id, tabId: tab._id, ...LIVE },
    Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
    { returnDocument: "after", runValidators: true },
  ).lean<TransactionDoc>();
  if (!doc) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  await touchTab(tab._id);
  return toSingleRow(doc, actor);
}

/** Hides a row and records who deleted it. Nothing is erased; restoreTransaction brings it back. */
export async function deleteTransaction(input: TransactionRef, actor: Actor): Promise<{ tabId: string }> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId);
  await loadWritableTab(existing.tabId.toString(), actor);
  await Transaction.updateOne(
    { _id: existing._id, ...LIVE },
    { $set: { deletedAt: new Date(), deletedBy: new Types.ObjectId(actor.userId) } },
    { timestamps: false },
  );
  await touchTab(existing.tabId);
  return { tabId: existing.tabId.toString() };
}

/** Brings a deleted row back exactly as it was. Not an edit: its authors don't change. */
export async function restoreTransaction(input: TransactionRef, actor: Actor): Promise<{ tabId: string }> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId, { deleted: true });
  await loadWritableTab(existing.tabId.toString(), actor);
  await Transaction.updateOne(
    { _id: existing._id },
    { $unset: { deletedAt: 1, deletedBy: 1 } },
    { timestamps: false },
  );
  await touchTab(existing.tabId);
  return { tabId: existing.tabId.toString() };
}

/** Copies a row's saved values into a new row at the end of the tab. */
export async function duplicateTransaction(
  input: TransactionRef,
  actor: Actor,
): Promise<TransactionRow & { tabId: string }> {
  await connectToDatabase();
  const existing = await loadTransaction(input.transactionId);
  await loadWritableTab(existing.tabId.toString(), actor);
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
    // The copy is a new row, added by whoever duplicated it.
    createdBy: new Types.ObjectId(actor.userId),
  });
  await touchTab(existing.tabId);
  return { ...(await toSingleRow(doc.toObject<TransactionDoc>(), actor)), tabId: existing.tabId.toString() };
}

/** True when every editable field already holds this value (no edit to record). */
function sameAsStored(existing: TransactionDoc, fields: ReturnType<typeof persistedFields>): boolean {
  const comparable = (value: unknown) => {
    if (value === undefined || value === null) return null;
    if (value instanceof Types.ObjectId) return value.toString();
    if (value instanceof Date) return value.toISOString();
    return value;
  };
  return (Object.keys(fields) as (keyof typeof fields)[]).every(
    (key) => comparable(fields[key]) === comparable(existing[key]),
  );
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

/** A live row, or with `deleted: true` a deleted one. Anything else is "not found". */
async function loadTransaction(transactionId: string, options: { deleted?: boolean } = {}) {
  const doc = await Transaction.findById(new Types.ObjectId(transactionId)).lean<TransactionDoc>();
  const isDeleted = doc?.deletedAt != null;
  if (!doc || isDeleted !== Boolean(options.deleted)) {
    throw new DomainError(
      "not-found",
      options.deleted ? "This transaction isn't deleted any more." : NOT_FOUND_MESSAGE,
    );
  }
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
