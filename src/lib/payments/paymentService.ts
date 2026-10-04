import "server-only";
import { DomainError } from "@/lib/actions/result";
import { calculatePairwiseSettlements } from "@/lib/settlement/calculatePairwiseSettlements";
import { formatPhp } from "@/lib/settlement/money";
import { balanceBetween } from "@/lib/settlement/personTotals";
import { toSettlementInput } from "@/lib/settlements/buildSettlementSummary";
import { loadWritableTab } from "@/lib/tabs/tabService";
import { createTransaction, listTransactions } from "@/lib/transactions/transactionService";
import type { TransactionRow } from "@/lib/transactions/types";
import type { RecordPaymentInput } from "@/schemas/payment";

/**
 * Records a payment as its own row (type "payment", debtor → creditor).
 * No existing row is changed. If it is larger than what the debtor owes,
 * it is refused until the user confirms (D1): saving it flips the balance.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<TransactionRow> {
  await loadWritableTab(input.tabId);

  if (!input.allowOverpayment) {
    const rows = await listTransactions(input.tabId);
    const settlements = calculatePairwiseSettlements(rows.map(toSettlementInput));
    const owed = balanceBetween(settlements, input.debtorId, input.creditorId);
    if (input.amountPhpCentavos > owed) {
      const message =
        owed > 0
          ? `That's more than the ${formatPhp(owed)} outstanding. Saving it will leave the difference owed back the other way.`
          : "Nothing is owed in this direction right now, so this payment would create a debt the other way.";
      throw new DomainError("conflict", message, { amountPhp: message });
    }
  }

  return createTransaction({
    tabId: input.tabId,
    type: "payment",
    description: input.description,
    foreignCurrency: undefined,
    foreignAmountMinor: undefined,
    amountPhpCentavos: input.amountPhpCentavos,
    payerId: input.debtorId,
    recipientId: input.creditorId,
    transactionDate: input.transactionDate,
    notes: undefined,
  });
}
