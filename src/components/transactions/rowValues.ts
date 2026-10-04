import { minorUnitsFor } from "@/lib/currency";
import { minorToInputString } from "@/lib/settlement/money";
import type { TransactionType } from "@/lib/settlement/types";
import type { TransactionRow } from "@/lib/transactions/types";
import type { TransactionFormInput } from "@/schemas/transaction";

/**
 * What a table row's inputs hold: plain strings, exactly as typed. Parsing
 * into centavos happens on the server (transactionInputSchema), so the
 * browser never does money arithmetic.
 */
export type RowValues = {
  description: string;
  foreignCurrency: string;
  foreignAmount: string;
  amountPhp: string;
  payerId: string;
  recipientId: string;
  type: TransactionType;
  /** Not shown as columns yet; carried along so an edit never drops them. */
  transactionDate: string;
  notes: string;
};

export type EditableField = "description" | "foreignCurrency" | "foreignAmount" | "amountPhp" | "payerId" | "recipientId" | "type";

export const EMPTY_ROW: RowValues = {
  description: "",
  foreignCurrency: "",
  foreignAmount: "",
  amountPhp: "",
  payerId: "",
  recipientId: "",
  type: "expense",
  transactionDate: "",
  notes: "",
};

export function toRowValues(row: TransactionRow): RowValues {
  return {
    description: row.description,
    foreignCurrency: row.foreignCurrency ?? "",
    foreignAmount:
      row.foreignCurrency && row.foreignAmountMinor !== null
        ? minorToInputString(row.foreignAmountMinor, minorUnitsFor(row.foreignCurrency))
        : "",
    amountPhp: minorToInputString(row.amountPhpCentavos),
    payerId: row.payerId,
    recipientId: row.recipientId,
    type: row.type,
    transactionDate: row.transactionDate ?? "",
    notes: row.notes ?? "",
  };
}

const KEYS = Object.keys(EMPTY_ROW) as (keyof RowValues)[];

export function sameValues(a: RowValues, b: RowValues): boolean {
  return KEYS.every((key) => a[key] === b[key]);
}

/** True when nothing has been typed (the type selector alone doesn't count). */
export function isBlank(values: RowValues): boolean {
  return KEYS.every((key) => key === "type" || values[key].trim() === "");
}

export function hasForeign(values: RowValues): boolean {
  return values.foreignCurrency.trim() !== "" || values.foreignAmount.trim() !== "";
}

export function toActionInput(tabId: string, values: RowValues): TransactionFormInput {
  return { tabId, ...values };
}

/** Reads a value restored from storage, rejecting anything that isn't a complete RowValues. */
export function parseStoredValues(value: unknown): RowValues | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!KEYS.every((key) => typeof record[key] === "string")) return null;
  if (record.type !== "expense" && record.type !== "payment") return null;
  return Object.fromEntries(KEYS.map((key) => [key, record[key]])) as RowValues;
}
