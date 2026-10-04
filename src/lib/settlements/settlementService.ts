import "server-only";
import { Types } from "mongoose";
import type { Actor } from "@/lib/auth/actor";
import { connectToDatabase } from "@/lib/db/connect";
import { loadReadableTab } from "@/lib/tabs/tabService";
import type { TransactionRow } from "@/lib/transactions/types";
import { listTransactions } from "@/lib/transactions/transactionService";
import { Person } from "@/models/Person";
import { buildSettlementSummary } from "./buildSettlementSummary";
import type { SettlementPerson, SettlementSummary } from "./types";

/**
 * Settlements are derived, never stored (DATA_MODEL.md): computed from the
 * tab's transactions on every request, so any edit is reflected at once.
 */
export async function getSettlements(tabId: string, actor: Actor): Promise<SettlementSummary> {
  return (await getSettlementExport(tabId, actor)).summary;
}

export type SettlementExport = {
  tabName: string;
  people: SettlementPerson[];
  rows: TransactionRow[];
  summary: SettlementSummary;
};

/**
 * Everything the exports (share image, CSV) need, for anyone who may read
 * the tab: its owner or an admin. Others get "not found".
 */
export async function getSettlementExport(tabId: string, actor: Actor): Promise<SettlementExport> {
  await connectToDatabase();
  const tab = await loadReadableTab(tabId, actor);
  const [peopleDocs, rows] = await Promise.all([
    Person.find({ tabId: new Types.ObjectId(tabId) }, { displayName: 1 }).lean(),
    listTransactions(tabId, actor),
  ]);
  const people = peopleDocs.map((person) => ({ id: person._id.toString(), displayName: person.displayName }));
  return { tabName: tab.name, people, rows, summary: buildSettlementSummary(rows, people) };
}
