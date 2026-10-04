import { z } from "zod";
import { objectIdSchema, requiredText } from "./common";
import { parsePhpAmount, personRef, phpAmountField, transactionDateField } from "./transaction";

/**
 * "Split a bill": one total paid by one person, shared by the ticked
 * participants. Becomes one expense row per other participant
 * (SETTLEMENT_RULES.md → Splitting a bill).
 */
export const splitExpenseSchema = z
  .object({
    tabId: objectIdSchema,
    description: requiredText("Description", 200),
    amountPhp: phpAmountField,
    payerId: personRef("Choose who paid"),
    participantIds: z
      .array(objectIdSchema, { error: "Choose who shared it" })
      .min(1, "Choose who shared it")
      .max(100, "Too many people"),
    transactionDate: transactionDateField,
  })
  .refine((input) => new Set(input.participantIds).size === input.participantIds.length, {
    path: ["participantIds"],
    message: "Each person can only be chosen once",
  })
  .transform((input) => ({
    tabId: input.tabId,
    description: input.description,
    totalCentavos: parsePhpAmount(input.amountPhp),
    payerId: input.payerId,
    participantIds: input.participantIds,
    transactionDate: input.transactionDate,
  }));

export type SplitExpenseFormInput = z.input<typeof splitExpenseSchema>;
export type SplitExpenseInput = z.output<typeof splitExpenseSchema>;
