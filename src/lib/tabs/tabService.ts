import "server-only";
import { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import { connectToDatabase } from "@/lib/db/connect";
import { Person } from "@/models/Person";
import { Tab } from "@/models/Tab";
import { Transaction } from "@/models/Transaction";
import { normalizePersonName, type PersonDelete, type PersonInput, type PersonUpdate } from "@/schemas/person";
import type { CreateTabInput, SetTabArchivedInput, UpdateTabDetailsInput } from "@/schemas/tab";
import type { PersonSummary, TabDetail, TabStatus, TabSummary } from "./types";

/**
 * Tabs and participants. Inputs are already Zod-validated (ids are valid
 * 24-hex strings). Expected failures throw DomainError; callers map them.
 */

const READ_ONLY_MESSAGE = "This tab is archived. Unarchive it to make changes.";

type TabDoc = {
  _id: Types.ObjectId;
  name: string;
  description?: string | null;
  status: TabStatus;
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(tab: TabDoc, participantCount: number, transactionCount: number): TabSummary {
  return {
    id: tab._id.toString(),
    name: tab.name,
    description: tab.description ?? null,
    status: tab.status,
    participantCount,
    transactionCount,
    createdAt: tab.createdAt.toISOString(),
    updatedAt: tab.updatedAt.toISOString(),
  };
}

async function countByTab(model: typeof Person | typeof Transaction, tabIds: Types.ObjectId[]) {
  const rows = await (model as typeof Person).aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { tabId: { $in: tabIds } } },
    { $group: { _id: "$tabId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

/** All tabs, most recently updated first. */
export async function listTabs(): Promise<TabSummary[]> {
  await connectToDatabase();
  const tabs = await Tab.find().sort({ updatedAt: -1 }).lean<TabDoc[]>();
  const ids = tabs.map((tab) => tab._id);
  const [people, transactions] = await Promise.all([countByTab(Person, ids), countByTab(Transaction, ids)]);
  return tabs.map((tab) =>
    toSummary(tab, people.get(tab._id.toString()) ?? 0, transactions.get(tab._id.toString()) ?? 0),
  );
}

/** One tab with its people, or null if it does not exist. */
export async function getTabDetail(tabId: string): Promise<TabDetail | null> {
  await connectToDatabase();
  const id = new Types.ObjectId(tabId);
  const tab = await Tab.findById(id).lean<TabDoc>();
  if (!tab) return null;

  const [people, involvement, transactionCount] = await Promise.all([
    Person.find({ tabId: id }).sort({ createdAt: 1 }).lean(),
    Transaction.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { tabId: id } },
      { $project: { person: ["$payerId", "$recipientId"] } },
      { $unwind: "$person" },
      { $group: { _id: "$person", count: { $sum: 1 } } },
    ]),
    Transaction.countDocuments({ tabId: id }),
  ]);
  const counts = new Map(involvement.map((row) => [row._id.toString(), row.count]));

  const personSummaries: PersonSummary[] = people.map((person) => ({
    id: person._id.toString(),
    displayName: person.displayName,
    transactionCount: counts.get(person._id.toString()) ?? 0,
  }));

  return { tab: toSummary(tab, people.length, transactionCount), people: personSummaries };
}

export async function createTab(input: CreateTabInput): Promise<{ id: string }> {
  await connectToDatabase();
  const tab = await Tab.create({ name: input.name, description: input.description });
  return { id: tab._id.toString() };
}

export async function updateTabDetails(input: UpdateTabDetailsInput): Promise<void> {
  await connectToDatabase();
  const tab = await loadTab(input.tabId);
  if (tab.status === "archived") throw new DomainError("read-only", READ_ONLY_MESSAGE);
  await Tab.updateOne(
    { _id: tab._id },
    input.description
      ? { $set: { name: input.name, description: input.description } }
      : { $set: { name: input.name }, $unset: { description: 1 } },
  );
}

/** Archiving makes a tab read-only (D6); unarchiving is always allowed. */
export async function setTabArchived(input: SetTabArchivedInput): Promise<void> {
  await connectToDatabase();
  const tab = await loadTab(input.tabId);
  await Tab.updateOne({ _id: tab._id }, { $set: { status: input.archived ? "archived" : "active" } });
}

export async function addPerson(input: PersonInput): Promise<{ id: string }> {
  await connectToDatabase();
  const tab = await loadWritableTab(input.tabId);
  const normalizedName = normalizePersonName(input.displayName);
  await assertNameAvailable(tab._id, normalizedName, input.displayName);
  try {
    const person = await Person.create({ tabId: tab._id, displayName: input.displayName, normalizedName });
    await touchTab(tab._id);
    return { id: person._id.toString() };
  } catch (error) {
    throw duplicateNameOr(error, input.displayName);
  }
}

/** Renames a person. History stays intact because rows reference the id. */
export async function renamePerson(input: PersonUpdate): Promise<{ tabId: string }> {
  await connectToDatabase();
  const person = await loadPerson(input.personId);
  await loadWritableTab(person.tabId.toString());
  const normalizedName = normalizePersonName(input.displayName);
  if (normalizedName !== person.normalizedName) {
    await assertNameAvailable(person.tabId, normalizedName, input.displayName);
  }
  try {
    await Person.updateOne({ _id: person._id }, { $set: { displayName: input.displayName, normalizedName } });
    await touchTab(person.tabId);
  } catch (error) {
    throw duplicateNameOr(error, input.displayName);
  }
  return { tabId: person.tabId.toString() };
}

/** Removes a person who has no transactions (D5). */
export async function deletePerson(input: PersonDelete): Promise<{ tabId: string }> {
  await connectToDatabase();
  const person = await loadPerson(input.personId);
  await loadWritableTab(person.tabId.toString());
  const used = await Transaction.exists({ $or: [{ payerId: person._id }, { recipientId: person._id }] });
  if (used) {
    throw new DomainError(
      "in-use",
      `${person.displayName} appears in transactions, so they can't be removed. You can still rename them.`,
    );
  }
  await Person.deleteOne({ _id: person._id });
  await touchTab(person.tabId);
  return { tabId: person.tabId.toString() };
}

/** Throws unless the tab exists and is active. Used by every write inside a tab. */
export async function loadWritableTab(tabId: string) {
  const tab = await loadTab(tabId);
  if (tab.status === "archived") throw new DomainError("read-only", READ_ONLY_MESSAGE);
  return tab;
}

async function loadTab(tabId: string) {
  const tab = await Tab.findById(new Types.ObjectId(tabId)).lean<TabDoc>();
  if (!tab) throw new DomainError("not-found", "This tab no longer exists.");
  return tab;
}

async function loadPerson(personId: string) {
  const person = await Person.findById(new Types.ObjectId(personId)).lean();
  if (!person) throw new DomainError("not-found", "This person no longer exists.");
  return person;
}

async function assertNameAvailable(tabId: Types.ObjectId, normalizedName: string, displayName: string) {
  if (await Person.exists({ tabId, normalizedName })) throw duplicateName(displayName);
}

function duplicateName(displayName: string) {
  return new DomainError("conflict", `Someone named "${displayName}" is already in this tab.`, {
    displayName: "That name is already in this tab.",
  });
}

/** Maps a unique-index race (E11000) to the same friendly conflict. */
function duplicateNameOr(error: unknown, displayName: string): unknown {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 11000 ? duplicateName(displayName) : error;
}

/** Keeps "recently updated" ordering meaningful when people or transactions change. */
export async function touchTab(tabId: Types.ObjectId) {
  await Tab.updateOne({ _id: tabId }, { $currentDate: { updatedAt: true } });
}
