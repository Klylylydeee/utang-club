import { assertMinorUnits } from "./money";

/**
 * Splits a bill into the rows to record (SETTLEMENT_RULES.md → Splitting
 * a bill). Each participant's share is floor(total / n) centavos; the
 * leftover centavos go one each to the debtors (participants other than
 * the payer) in the order given, which callers pass in display-name
 * order. The payer's own share creates no row.
 *
 * Integer-only: the share is (total − total mod n) / n, an exact division.
 */
export type SplitResult =
  | {
      ok: true;
      /** One entry per debtor, in input order: they owe the payer this much. */
      debts: { personId: string; amountPhpCentavos: number }[];
      /** The payer's own share when they are a participant, else null. */
      payerShareCentavos: number | null;
    }
  | { ok: false; reason: "no-debtors" | "too-small" };

export function splitAmount(
  totalCentavos: number,
  participantIds: readonly string[],
  payerId: string,
): SplitResult {
  assertMinorUnits(totalCentavos, "total");
  if (totalCentavos <= 0) throw new RangeError("total must be positive");
  if (new Set(participantIds).size !== participantIds.length) throw new RangeError("participants must be unique");

  const debtors = participantIds.filter((id) => id !== payerId);
  if (debtors.length === 0) return { ok: false, reason: "no-debtors" };

  const count = participantIds.length;
  const leftover = totalCentavos % count;
  const share = (totalCentavos - leftover) / count;
  if (share === 0) return { ok: false, reason: "too-small" };

  // leftover < count, and count ≤ debtors + 1, so leftover ≤ debtors.length.
  const debts = debtors.map((personId, index) => ({
    personId,
    amountPhpCentavos: share + (index < leftover ? 1 : 0),
  }));
  return { ok: true, debts, payerShareCentavos: debtors.length < count ? share : null };
}
