import "server-only";
import { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import type { Actor } from "@/lib/auth/actor";
import { connectToDatabase } from "@/lib/db/connect";
import { formatPhp } from "@/lib/settlement/money";
import { compareByName } from "@/lib/settlement/orderSettlements";
import { splitAmount } from "@/lib/settlement/splitAmount";
import { loadWritableTab, touchTab } from "@/lib/tabs/tabService";
import { pluralize } from "@/lib/text";
import { Person } from "@/models/Person";
import { Transaction } from "@/models/Transaction";
import type { SplitExpenseInput } from "@/schemas/split";

/**
 * Splits a bill into ordinary expense rows, one per participant other
 * than the payer, each owing the payer their share (rounding per
 * SETTLEMENT_RULES.md → Splitting a bill). Every row notes the split it
 * came from, so the audit trail explains odd centavos.
 */
export async function splitExpense(input: SplitExpenseInput, actor: Actor): Promise<{ created: number }> {
  await connectToDatabase();
  const tab = await loadWritableTab(input.tabId, actor);

  const people = await Person.find({ tabId: tab._id }, { displayName: 1 }).lean();
  const byId = new Map(people.map((person) => [person._id.toString(), { id: person._id.toString(), displayName: person.displayName }]));

  const fieldErrors: Record<string, string> = {};
  if (!byId.has(input.payerId)) fieldErrors.payerId = "Choose someone in this tab";
  if (input.participantIds.some((id) => !byId.has(id))) fieldErrors.participantIds = "Choose people in this tab";
  if (Object.keys(fieldErrors).length > 0) throw new DomainError("validation", "Pick people from this tab.", fieldErrors);

  const participants = input.participantIds.map((id) => byId.get(id)!).sort(compareByName);
  const result = splitAmount(
    input.totalCentavos,
    participants.map((person) => person.id),
    input.payerId,
  );
  if (!result.ok) {
    throw result.reason === "no-debtors"
      ? new DomainError("validation", "Choose at least one person besides who paid.", {
          participantIds: "Choose at least one person besides who paid",
        })
      : new DomainError("validation", "That amount is too small to split.", {
          amountPhp: `Too small to split between ${pluralize(participants.length, "person", "people")}`,
        });
  }

  const note = `Split of ${formatPhp(input.totalCentavos)} between ${pluralize(participants.length, "person", "people")}, paid by ${byId.get(input.payerId)!.displayName}`;
  await Transaction.insertMany(
    result.debts.map((debt) => ({
      tabId: tab._id,
      type: "expense",
      description: input.description,
      amountPhpCentavos: debt.amountPhpCentavos,
      payerId: new Types.ObjectId(debt.personId),
      recipientId: new Types.ObjectId(input.payerId),
      transactionDate: input.transactionDate ? new Date(`${input.transactionDate}T00:00:00.000Z`) : undefined,
      notes: note.slice(0, 1000),
      createdBy: new Types.ObjectId(actor.userId),
    })),
  );
  await touchTab(tab._id);
  return { created: result.debts.length };
}
