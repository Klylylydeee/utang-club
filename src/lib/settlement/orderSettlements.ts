import type { PairwiseSettlement } from "./types";

/** Display names keyed by person id. */
export type PersonNames = ReadonlyMap<string, string>;

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Display-name order used everywhere (cards, people, split leftovers). Ids break ties. */
export function compareByName(a: { id: string; displayName: string }, b: { id: string; displayName: string }): number {
  return collator.compare(a.displayName, b.displayName) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Display order (SETTLEMENT_RULES.md → Ordering): by debtor display name,
 * then creditor display name, case-insensitively. Person ids break ties
 * so two people with similar names still sort deterministically.
 *
 * A settled pair has no real direction, so it is oriented with the
 * alphabetically-first person as `debtorId`; line-item effects are
 * flipped accordingly. Returns new objects; the input is not modified.
 */
export function orderSettlements(
  settlements: readonly PairwiseSettlement[],
  names: PersonNames,
): PairwiseSettlement[] {
  const nameOf = (id: string) => names.get(id) ?? id;
  const compare = (aId: string, bId: string) =>
    collator.compare(nameOf(aId), nameOf(bId)) || (aId < bId ? -1 : aId > bId ? 1 : 0);

  return settlements
    .map((settlement) =>
      settlement.status === "settled" && compare(settlement.debtorId, settlement.creditorId) > 0
        ? reorient(settlement)
        : settlement,
    )
    .sort((a, b) => compare(a.debtorId, b.debtorId) || compare(a.creditorId, b.creditorId));
}

/** Swaps the two people of a settled (zero-balance) pair. */
function reorient(settlement: PairwiseSettlement): PairwiseSettlement {
  const { breakdown } = settlement;
  return {
    ...settlement,
    debtorId: settlement.creditorId,
    creditorId: settlement.debtorId,
    lineItems: settlement.lineItems.map((item) => ({ ...item, effectCentavos: -item.effectCentavos })),
    breakdown: {
      debtorOwesCentavos: breakdown.creditorOwesCentavos,
      creditorOwesCentavos: breakdown.debtorOwesCentavos,
      debtorPaidCentavos: breakdown.creditorPaidCentavos,
      creditorPaidCentavos: breakdown.debtorPaidCentavos,
    },
  };
}
