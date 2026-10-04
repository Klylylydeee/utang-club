import { calculatePairwiseSettlements } from "@/lib/settlement/calculatePairwiseSettlements";
import { addMinor } from "@/lib/settlement/money";
import { compareByName, orderSettlements } from "@/lib/settlement/orderSettlements";
import { calculatePersonTotals } from "@/lib/settlement/personTotals";
import type { PairwiseSettlement, SettlementInput } from "@/lib/settlement/types";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SettlementCard, SettlementPerson, SettlementSummary } from "./types";

/**
 * Turns a tab's rows into settlement cards. Pure: the engine does the
 * netting; this only maps ids to names and rows to line items, so the
 * UI renders without doing any arithmetic.
 */
export function buildSettlementSummary(
  rows: readonly TransactionRow[],
  people: readonly SettlementPerson[],
): SettlementSummary {
  const names = new Map(people.map((person) => [person.id, person.displayName]));
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const settlements = orderSettlements(calculatePairwiseSettlements(rows.map(toSettlementInput)), names);

  const cards = settlements.map((settlement) => toCard(settlement, rowsById, names));
  const sortedPeople = [...people].sort(compareByName);
  const totals = calculatePersonTotals(
    settlements,
    sortedPeople.map((person) => person.id),
  );
  return {
    outstanding: cards.filter((card) => card.status === "outstanding"),
    settled: cards.filter((card) => card.status === "settled"),
    people: totals.map((total, index) => ({
      person: sortedPeople[index],
      owesCentavos: total.owesCentavos,
      owedCentavos: total.owedCentavos,
      netCentavos: total.netCentavos,
    })),
  };
}

export function toSettlementInput(row: TransactionRow): SettlementInput {
  return {
    id: row.id,
    type: row.type,
    payerId: row.payerId,
    recipientId: row.recipientId,
    amountPhpCentavos: row.amountPhpCentavos,
    transactionDate: row.transactionDate ? new Date(`${row.transactionDate}T00:00:00.000Z`) : null,
    createdAt: new Date(row.createdAt),
  };
}

function toCard(
  settlement: PairwiseSettlement,
  rowsById: ReadonlyMap<string, TransactionRow>,
  names: ReadonlyMap<string, string>,
): SettlementCard {
  const person = (id: string) => ({ id, displayName: names.get(id) ?? "Unknown" });
  const { breakdown } = settlement;

  return {
    key: `${settlement.debtorId}:${settlement.creditorId}`,
    debtor: person(settlement.debtorId),
    creditor: person(settlement.creditorId),
    status: settlement.status,
    amountPhpCentavos: settlement.amountPhpCentavos,
    owedCentavos: addMinor(breakdown.debtorOwesCentavos, breakdown.creditorPaidCentavos),
    reducedCentavos: addMinor(breakdown.creditorOwesCentavos, breakdown.debtorPaidCentavos),
    lines: settlement.lineItems.map((item) => {
      const row = rowsById.get(item.transactionId);
      return {
        transactionId: item.transactionId,
        description: row?.description ?? "",
        type: item.type,
        direction: item.payerId === settlement.debtorId ? "debtor-to-creditor" : "creditor-to-debtor",
        amountPhpCentavos: item.amountPhpCentavos,
        effectCentavos: item.effectCentavos,
        foreignCurrency: row?.foreignCurrency ?? null,
        foreignAmountMinor: row?.foreignAmountMinor ?? null,
        transactionDate: row?.transactionDate ?? null,
        addedBy: row?.addedBy ?? null,
        editedBy: row?.editedBy ?? null,
      };
    }),
  };
}
