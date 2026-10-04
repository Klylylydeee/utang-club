import { z } from "zod";
import { CURRENCY_CODE_PATTERN, minorUnitsFor } from "@/lib/currency";
import { parseMoneyToMinor, PHP_MINOR_UNITS, type ParseMoneyResult } from "@/lib/settlement/money";
import { objectIdSchema, optionalText, requiredText } from "./common";

const MONEY_ERRORS: Record<Exclude<ParseMoneyResult, { ok: true }>["reason"], string> = {
  empty: "Amount is required",
  malformed: "Enter an amount like 1,234.56",
  "too-many-decimals": "Too many decimal places",
  "too-large": "Amount is too large",
};

/** A required participant picker value: empty → friendly message, else an ObjectId. */
function personRef(missingMessage: string) {
  return z.string({ error: missingMessage }).trim().min(1, missingMessage).pipe(objectIdSchema);
}

/** Raw transaction row as typed by the user (strings from the table/form). */
const transactionFields = z.object({
  tabId: objectIdSchema,
  type: z.enum(["expense", "payment"]).default("expense"),
  description: requiredText("Description", 200),
  foreignCurrency: optionalText(3),
  foreignAmount: optionalText(32),
  // Checked per field (not only in the transform below) so its error is
  // reported together with the other fields' errors.
  amountPhp: z.string({ error: "Amount is required" }).superRefine((value, ctx) => {
    const php = parseMoneyToMinor(value, PHP_MINOR_UNITS);
    if (!php.ok) ctx.addIssue({ code: "custom", message: MONEY_ERRORS[php.reason] });
    else if (php.minor <= 0) ctx.addIssue({ code: "custom", message: "Amount must be greater than zero" });
  }),
  payerId: personRef("Choose who owes"),
  recipientId: personRef("Choose who is owed"),
  transactionDate: z.iso.date({ error: "Use a valid date" }).optional().or(z.literal("").transform(() => undefined)),
  notes: optionalText(1000),
});

/**
 * Payer and recipient must differ. Runs even when other fields failed
 * (`when`), so every field error is reported in one pass.
 */
function differentPeople(row: { payerId?: unknown; recipientId?: unknown }) {
  return !row.payerId || row.payerId !== row.recipientId;
}
const DIFFERENT_PEOPLE_ISSUE = {
  path: ["recipientId"],
  message: "Payer and recipient must be different people",
  when: (payload: z.core.ParsePayload) => typeof payload.value === "object" && payload.value !== null,
};

/** Amounts are parsed to integer minor units; nothing is a float. */
export const transactionInputSchema = transactionFields.refine(differentPeople, DIFFERENT_PEOPLE_ISSUE).transform(toTransactionInput);

/** An edit replaces every field of an existing row. `tabId` must be the row's own tab. */
export const transactionUpdateSchema = transactionFields
  .extend({ transactionId: objectIdSchema })
  .refine(differentPeople, DIFFERENT_PEOPLE_ISSUE)
  .transform((row, ctx) => ({ ...toTransactionInput(row, ctx), transactionId: row.transactionId }));

/** Identifies one row for delete and duplicate. */
export const transactionRefSchema = z.object({ transactionId: objectIdSchema });

function toTransactionInput(row: z.output<typeof transactionFields>, ctx: z.RefinementCtx) {
  // Already validated on the field; parsed again here for the value.
  const php = parseMoneyToMinor(row.amountPhp, PHP_MINOR_UNITS);

  const currency = row.foreignCurrency?.toUpperCase();
  let foreignAmountMinor: number | undefined;
  if (currency !== undefined || row.foreignAmount !== undefined) {
    if (currency === undefined || !CURRENCY_CODE_PATTERN.test(currency)) {
      ctx.addIssue({ code: "custom", path: ["foreignCurrency"], message: "Use a 3-letter currency code, e.g. USD" });
    } else if (row.foreignAmount === undefined) {
      ctx.addIssue({ code: "custom", path: ["foreignAmount"], message: "Enter the foreign amount or clear the currency" });
    } else {
      const foreign = parseMoneyToMinor(row.foreignAmount, minorUnitsFor(currency));
      if (!foreign.ok) {
        ctx.addIssue({ code: "custom", path: ["foreignAmount"], message: MONEY_ERRORS[foreign.reason] });
      } else if (foreign.minor <= 0) {
        ctx.addIssue({ code: "custom", path: ["foreignAmount"], message: "Amount must be greater than zero" });
      } else {
        foreignAmountMinor = foreign.minor;
      }
    }
  }

  if (!php.ok) return z.NEVER;

  return {
    tabId: row.tabId,
    type: row.type,
    description: row.description,
    foreignCurrency: foreignAmountMinor === undefined ? undefined : currency,
    foreignAmountMinor,
    amountPhpCentavos: php.minor,
    payerId: row.payerId,
    recipientId: row.recipientId,
    transactionDate: row.transactionDate,
    notes: row.notes,
  };
}

export type TransactionFormInput = z.input<typeof transactionInputSchema>;
export type TransactionInput = z.output<typeof transactionInputSchema>;
export type TransactionUpdateFormInput = z.input<typeof transactionUpdateSchema>;
export type TransactionUpdate = z.output<typeof transactionUpdateSchema>;
export type TransactionRef = z.output<typeof transactionRefSchema>;
