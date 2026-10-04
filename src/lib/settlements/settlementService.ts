import "server-only";
import { Types } from "mongoose";
import type { Actor } from "@/lib/auth/actor";
import { connectToDatabase } from "@/lib/db/connect";
import { loadReadableTab } from "@/lib/tabs/tabService";
import { listTransactions } from "@/lib/transactions/transactionService";
import { Person } from "@/models/Person";
import { buildSettlementSummary } from "./buildSettlementSummary";
import type { SettlementSummary } from "./types";

/**
 * Settlements are derived, never stored (DATA_MODEL.md): computed from the
 * tab's transactions on every request, so any edit is reflected at once.
 */
export async function getSettlements(tabId: string, actor: Actor): Promise<SettlementSummary> {
  await connectToDatabase();
  await loadReadableTab(tabId, actor);
  const [people, rows] = await Promise.all([
    Person.find({ tabId: new Types.ObjectId(tabId) }, { displayName: 1 }).lean(),
    listTransactions(tabId, actor),
  ]);
  return buildSettlementSummary(
    rows,
    people.map((person) => ({ id: person._id.toString(), displayName: person.displayName })),
  );
}
