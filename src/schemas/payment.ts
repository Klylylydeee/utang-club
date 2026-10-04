import { z } from "zod";
import { objectIdSchema, optionalText } from "./common";
import { parsePhpAmount, personRef, phpAmountField, transactionDateField } from "./transaction";

/**
 * "Record payment" from a settlement card. Stored as an ordinary
 * transaction with type "payment", debtor → creditor (SETTLEMENT_RULES.md).
 * Paying more than is outstanding needs `allowOverpayment` (decision D1).
 */
export const recordPaymentSchema = z
  .object({
    tabId: objectIdSchema,
    debtorId: personRef("Choose who is paying"),
    creditorId: personRef("Choose who is being paid"),
    amountPhp: phpAmountField,
    description: optionalText(200),
    transactionDate: transactionDateField,
    allowOverpayment: z.boolean().default(false),
  })
  .refine((input) => input.debtorId !== input.creditorId, {
    path: ["creditorId"],
    message: "Payer and recipient must be different people",
  })
  .transform((input) => ({
    tabId: input.tabId,
    debtorId: input.debtorId,
    creditorId: input.creditorId,
    amountPhpCentavos: parsePhpAmount(input.amountPhp),
    description: input.description ?? "Payment",
    transactionDate: input.transactionDate,
    allowOverpayment: input.allowOverpayment,
  }));

export type RecordPaymentFormInput = z.input<typeof recordPaymentSchema>;
export type RecordPaymentInput = z.output<typeof recordPaymentSchema>;
