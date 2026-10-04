import { addMinor, assertMinorUnits } from "./money";
import type { PairwiseSettlement, SettlementBreakdown, SettlementInput, SettlementLineItem } from "./types";

/**
 * Pairwise netting (SETTLEMENT_RULES.md).
 *
 * For each unordered pair {A, B}:
 *   net(A→B) = Σ expenses A→B − Σ expenses B→A − Σ payments A→B + Σ payments B→A
 * net > 0: A owes B; net < 0: B owes A; net = 0: settled.
 *
 * Pairs are never combined across people (no global simplification), and
 * settled pairs are still returned so their history stays visible (D2).
 *
 * Output is deterministic regardless of input order:
 * - settlements by debtorId, then creditorId (use orderSettlements for
 *   display-name order);
 * - line items by transactionDate (falling back to createdAt when a row
 *   has no date), then createdAt, then id.
 *
 * Pure: the input array and its objects are not modified.
 */
export function calculatePairwiseSettlements(transactions: readonly SettlementInput[]): PairwiseSettlement[] {
  const pairs = new Map<string, SettlementInput[]>();

  for (const transaction of transactions) {
    validate(transaction);
    const key = pairKey(transaction.payerId, transaction.recipientId);
    const group = pairs.get(key);
    if (group) group.push(transaction);
    else pairs.set(key, [transaction]);
  }

  const settlements = [...pairs.values()].map(settlePair);
  return settlements.sort(
    (a, b) => compareStrings(a.debtorId, b.debtorId) || compareStrings(a.creditorId, b.creditorId),
  );
}

function settlePair(group: SettlementInput[]): PairwiseSettlement {
  const [low, high] = orderedPair(group[0].payerId, group[0].recipientId);

  // Net from the perspective "low owes high".
  let net = 0;
  for (const transaction of group) {
    net = addMinor(net, effectOn(transaction, low));
  }

  const [debtorId, creditorId] = net < 0 ? [high, low] : [low, high];
  const sorted = [...group].sort(compareLineItemOrder);
  const lineItems = sorted.map((transaction) => toLineItem(transaction, debtorId));

  return {
    debtorId,
    creditorId,
    amountPhpCentavos: Math.abs(net),
    status: net === 0 ? "settled" : "outstanding",
    transactionIds: sorted.map((transaction) => transaction.id),
    lineItems,
    breakdown: breakdownFor(lineItems, debtorId),
  };
}

/**
 * Signed effect of a row on what `debtorId` owes the other person:
 * expenses add in their own direction; payments subtract in theirs.
 */
function effectOn(transaction: SettlementInput, debtorId: string): number {
  const sameDirection = transaction.payerId === debtorId;
  const increasesDebt = transaction.type === "expense" ? sameDirection : !sameDirection;
  return increasesDebt ? transaction.amountPhpCentavos : -transaction.amountPhpCentavos;
}

function toLineItem(transaction: SettlementInput, debtorId: string): SettlementLineItem {
  return {
    transactionId: transaction.id,
    type: transaction.type,
    payerId: transaction.payerId,
    recipientId: transaction.recipientId,
    amountPhpCentavos: transaction.amountPhpCentavos,
    effectCentavos: effectOn(transaction, debtorId),
  };
}

function breakdownFor(lineItems: readonly SettlementLineItem[], debtorId: string): SettlementBreakdown {
  const breakdown: SettlementBreakdown = {
    debtorOwesCentavos: 0,
    creditorOwesCentavos: 0,
    debtorPaidCentavos: 0,
    creditorPaidCentavos: 0,
  };
  for (const item of lineItems) {
    const fromDebtor = item.payerId === debtorId;
    const field: keyof SettlementBreakdown =
      item.type === "expense"
        ? fromDebtor
          ? "debtorOwesCentavos"
          : "creditorOwesCentavos"
        : fromDebtor
          ? "debtorPaidCentavos"
          : "creditorPaidCentavos";
    breakdown[field] = addMinor(breakdown[field], item.amountPhpCentavos);
  }
  return breakdown;
}

function validate(transaction: SettlementInput): void {
  if (transaction.payerId === transaction.recipientId) {
    throw new Error(`Transaction ${transaction.id}: payer and recipient must differ`);
  }
  assertMinorUnits(transaction.amountPhpCentavos, `Transaction ${transaction.id} amount`);
  if (transaction.amountPhpCentavos <= 0) {
    throw new RangeError(`Transaction ${transaction.id}: amount must be greater than zero`);
  }
  if (transaction.type !== "expense" && transaction.type !== "payment") {
    throw new Error(`Transaction ${transaction.id}: unknown type ${String(transaction.type)}`);
  }
}

function orderedPair(a: string, b: string): [string, string] {
  return compareStrings(a, b) <= 0 ? [a, b] : [b, a];
}

function pairKey(a: string, b: string): string {
  return orderedPair(a, b).join("\u0000");
}

function compareLineItemOrder(a: SettlementInput, b: SettlementInput): number {
  return (
    effectiveTime(a) - effectiveTime(b) ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    compareStrings(a.id, b.id)
  );
}

function effectiveTime(transaction: SettlementInput): number {
  return (transaction.transactionDate ?? transaction.createdAt).getTime();
}

/** Locale-independent comparison so ordering never depends on the runtime. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
