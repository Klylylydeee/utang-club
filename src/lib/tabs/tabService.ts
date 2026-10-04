import "server-only";
import mongoose, { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import type { Actor } from "@/lib/auth/actor";
import { connectToDatabase } from "@/lib/db/connect";
import { Person } from "@/models/Person";
import { Tab } from "@/models/Tab";
import { TabShare } from "@/models/TabShare";
import { Transaction } from "@/models/Transaction";
import { User } from "@/models/User";
import { normalizePersonName, type PersonDelete, type PersonInput, type PersonUpdate } from "@/schemas/person";
import type { CreateTabInput, SetTabArchivedInput, UpdateTabDetailsInput } from "@/schemas/tab";
import type { PersonSummary, SharedTabSummary, TabAccess, TabDetail, TabStatus, TabSummary } from "./types";

/**
 * Tabs and participants. Inputs are already Zod-validated (ids are valid
 * 24-hex strings). Expected failures throw DomainError; callers map them.
 *
 * Access (D15–D17, D19): an owner can read and change their tabs and manage
 * them (rename, archive, share). Someone the tab is shared with as an
 * editor can change what's inside it; as a viewer, only read it. An admin
 * can read anyone's tab. Anyone else gets "not found", so tab ids can't be
 * probed.
 */

const READ_ONLY_MESSAGE = "This tab is archived. Unarchive it to make changes.";
const ADMIN_READ_ONLY_MESSAGE = "Administrators can view other people's tabs but can't change them.";
const VIEWER_READ_ONLY_MESSAGE = "You can view this tab, but not change it. Ask its owner for edit access.";
const OWNER_ONLY_MESSAGE = "Only the tab's owner can do this.";
const NOT_FOUND_MESSAGE = "This tab no longer exists.";

type TabDoc = {
  _id: Types.ObjectId;
  ownerId?: Types.ObjectId | null;
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

/** The actor's own tabs, most recently updated first. */
export async function listTabs(actor: Actor): Promise<TabSummary[]> {
  return listTabsOwnedBy(actor.userId);
}

/** Another user's tabs, for the admin area. */
export async function listTabsForUser(userId: string, actor: Actor): Promise<TabSummary[]> {
  if (actor.role !== "admin" && actor.userId !== userId) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  return listTabsOwnedBy(userId);
}

async function listTabsOwnedBy(userId: string): Promise<TabSummary[]> {
  await connectToDatabase();
  const tabs = await Tab.find({ ownerId: new Types.ObjectId(userId) }).sort({ updatedAt: -1 }).lean<TabDoc[]>();
  return summarize(tabs);
}

/** Tabs other people shared with the actor (D19), most recently updated first. */
export async function listSharedTabs(actor: Actor): Promise<SharedTabSummary[]> {
  await connectToDatabase();
  const shares = await TabShare.find({ userId: new Types.ObjectId(actor.userId) }, { tabId: 1, role: 1 }).lean();
  if (shares.length === 0) return [];
  const roles = new Map(shares.map((share) => [share.tabId.toString(), share.role]));
  const tabs = await Tab.find({ _id: mongoose.trusted({ $in: shares.map((share) => share.tabId) }) })
    .sort({ updatedAt: -1 })
    .lean<TabDoc[]>();
  const ownerIds = tabs.flatMap((tab) => (tab.ownerId ? [tab.ownerId] : []));
  const owners = await User.find({ _id: mongoose.trusted({ $in: ownerIds }) }, { name: 1 }).lean();
  const ownerNames = new Map(owners.map((owner) => [owner._id.toString(), owner.name]));
  const summaries = await summarize(tabs);
  return summaries.map((summary, index) => ({
    ...summary,
    ownerName: ownerNames.get(tabs[index].ownerId?.toString() ?? "") ?? "Unknown",
    role: roles.get(summary.id) === "editor" ? "editor" : "viewer",
  }));
}

async function summarize(tabs: TabDoc[]): Promise<TabSummary[]> {
  const ids = tabs.map((tab) => tab._id);
  const [people, transactions] = await Promise.all([countByTab(Person, ids), countByTab(Transaction, ids)]);
  return tabs.map((tab) =>
    toSummary(tab, people.get(tab._id.toString()) ?? 0, transactions.get(tab._id.toString()) ?? 0),
  );
}

/** One tab with its people, or null if it doesn't exist or the actor may not see it. */
export async function getTabDetail(tabId: string, actor: Actor): Promise<TabDetail | null> {
  await connectToDatabase();
  const id = new Types.ObjectId(tabId);
  const tab = await Tab.findById(id).lean<TabDoc>();
  const access = tab ? await accessTo(tab, actor) : null;
  if (!tab || !access) return null;

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

  const owner = access !== "owner" && tab.ownerId ? await User.findById(tab.ownerId, { name: 1 }).lean() : null;

  return {
    tab: toSummary(tab, people.length, transactionCount),
    people: personSummaries,
    access,
    ownerName: owner?.name ?? null,
    ownerId: access === "admin" && tab.ownerId ? tab.ownerId.toString() : null,
  };
}

export async function createTab(input: CreateTabInput, actor: Actor): Promise<{ id: string }> {
  await connectToDatabase();
  const tab = await Tab.create({
    ownerId: new Types.ObjectId(actor.userId),
    name: input.name,
    description: input.description,
  });
  return { id: tab._id.toString() };
}

export async function updateTabDetails(input: UpdateTabDetailsInput, actor: Actor): Promise<void> {
  await connectToDatabase();
  const tab = await loadOwnedTab(input.tabId, actor);
  if (tab.status === "archived") throw new DomainError("read-only", READ_ONLY_MESSAGE);
  await Tab.updateOne(
    { _id: tab._id },
    input.description
      ? { $set: { name: input.name, description: input.description } }
      : { $set: { name: input.name }, $unset: { description: 1 } },
  );
}

/** Archiving makes a tab read-only (D6); unarchiving is always allowed. */
export async function setTabArchived(input: SetTabArchivedInput, actor: Actor): Promise<void> {
  await connectToDatabase();
  const tab = await loadOwnedTab(input.tabId, actor);
  await Tab.updateOne({ _id: tab._id }, { $set: { status: input.archived ? "archived" : "active" } });
}

export async function addPerson(input: PersonInput, actor: Actor): Promise<{ id: string }> {
  await connectToDatabase();
  const tab = await loadWritableTab(input.tabId, actor);
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
export async function renamePerson(input: PersonUpdate, actor: Actor): Promise<{ tabId: string }> {
  await connectToDatabase();
  const person = await loadPerson(input.personId);
  await loadWritableTab(person.tabId.toString(), actor);
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
export async function deletePerson(input: PersonDelete, actor: Actor): Promise<{ tabId: string }> {
  await connectToDatabase();
  const person = await loadPerson(input.personId);
  await loadWritableTab(person.tabId.toString(), actor);
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

/**
 * How the actor may use the tab, or null if they may not see it at all.
 * A share is more specific than the admin role, so an admin a tab is
 * shared with gets that share's access.
 */
async function accessTo(tab: TabDoc, actor: Actor): Promise<TabAccess | null> {
  if (tab.ownerId?.equals(actor.userId)) return "owner";
  const share = await TabShare.findOne({ tabId: tab._id, userId: new Types.ObjectId(actor.userId) }, { role: 1 }).lean();
  if (share) return share.role === "editor" ? "editor" : "viewer";
  return actor.role === "admin" ? "admin" : null;
}

async function loadTabWithAccess(tabId: string, actor: Actor) {
  const tab = await Tab.findById(new Types.ObjectId(tabId)).lean<TabDoc>();
  const access = tab ? await accessTo(tab, actor) : null;
  if (!tab || !access) throw new DomainError("not-found", NOT_FOUND_MESSAGE);
  return { tab, access };
}

/** Throws unless the actor may see the tab (owner, shared, or admin). Used by reads inside a tab. */
export async function loadReadableTab(tabId: string, actor: Actor) {
  return (await loadTabWithAccess(tabId, actor)).tab;
}

/**
 * Throws unless the actor owns the tab. For renaming, archiving and
 * sharing. Archived tabs pass (they can be unarchived).
 */
export async function loadOwnedTab(tabId: string, actor: Actor) {
  const { tab, access } = await loadTabWithAccess(tabId, actor);
  if (access !== "owner") throw new DomainError("read-only", readOnlyMessage(access));
  return tab;
}

/**
 * Throws unless the actor may change what's inside the tab (its owner, or
 * an editor) and it is active (D6). Used by every write inside a tab.
 */
export async function loadWritableTab(tabId: string, actor: Actor) {
  const { tab, access } = await loadTabWithAccess(tabId, actor);
  if (access !== "owner" && access !== "editor") throw new DomainError("read-only", readOnlyMessage(access));
  if (tab.status === "archived") throw new DomainError("read-only", READ_ONLY_MESSAGE);
  return tab;
}

function readOnlyMessage(access: TabAccess): string {
  if (access === "admin") return ADMIN_READ_ONLY_MESSAGE;
  if (access === "viewer") return VIEWER_READ_ONLY_MESSAGE;
  return OWNER_ONLY_MESSAGE;
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
