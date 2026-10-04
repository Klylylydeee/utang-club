import { addMinor, subtractMinor } from "./money";
import type { PairwiseSettlement } from "./types";

export type PersonTotal = {
  personId: string;
  /** Sum of what this person still owes others, across their pairs. */
  owesCentavos: number;
  /** Sum of what others still owe this person. */
  owedCentavos: number;
  /** owed − owes: positive means they get money back, negative means they pay. */
  netCentavos: number;
};

/**
 * Per-person view of the pairwise settlements. It only adds up each
 * person's pairs; it never moves debt between people (no global
 * simplification), so every figure traces back to a card.
 * Returns one entry per id in `personIds`, in that order.
 */
export function calculatePersonTotals(
  settlements: readonly PairwiseSettlement[],
  personIds: readonly string[],
): PersonTotal[] {
  const owes = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const settlement of settlements) {
    if (settlement.status !== "outstanding") continue;
    owes.set(settlement.debtorId, addMinor(owes.get(settlement.debtorId) ?? 0, settlement.amountPhpCentavos));
    owed.set(settlement.creditorId, addMinor(owed.get(settlement.creditorId) ?? 0, settlement.amountPhpCentavos));
  }
  return personIds.map((personId) => {
    const owesCentavos = owes.get(personId) ?? 0;
    const owedCentavos = owed.get(personId) ?? 0;
    return { personId, owesCentavos, owedCentavos, netCentavos: subtractMinor(owedCentavos, owesCentavos) };
  });
}

/**
 * What `debtorId` currently owes `creditorId`: positive when they owe,
 * negative when the debt runs the other way, 0 when settled or unrelated.
 */
export function balanceBetween(
  settlements: readonly PairwiseSettlement[],
  debtorId: string,
  creditorId: string,
): number {
  for (const settlement of settlements) {
    if (settlement.debtorId === debtorId && settlement.creditorId === creditorId) return settlement.amountPhpCentavos;
    if (settlement.debtorId === creditorId && settlement.creditorId === debtorId) return -settlement.amountPhpCentavos;
  }
  return 0;
}
