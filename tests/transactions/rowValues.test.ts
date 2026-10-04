import { describe, expect, it } from "vitest";
import {
  EMPTY_ROW,
  hasForeign,
  isBlank,
  parseStoredValues,
  sameValues,
  toActionInput,
  toRowValues,
} from "@/components/transactions/rowValues";
import { validateRow } from "@/components/transactions/validateRow";
import type { TransactionRow } from "@/lib/transactions/types";
import { transactionInputSchema } from "@/schemas/transaction";

const TAB = "65a0000000000000000000ff";
const ADRIAN = "65a000000000000000000001";
const KLYDE = "65a000000000000000000002";

const saved: TransactionRow = {
  id: "65a000000000000000000010",
  type: "expense",
  description: "Hotel",
  foreignCurrency: "JPY",
  foreignAmountMinor: 150000,
  amountPhpCentavos: 5878050,
  payerId: ADRIAN,
  recipientId: KLYDE,
  transactionDate: "2026-10-04",
  notes: "2 nights",
  createdAt: "2026-10-04T00:00:00.000Z",
  addedBy: null,
  editedBy: null,
};

describe("row values", () => {
  it("turns a saved row into editable strings without floats", () => {
    expect(toRowValues(saved)).toEqual({
      description: "Hotel",
      foreignCurrency: "JPY",
      foreignAmount: "150,000",
      amountPhp: "58,780.50",
      payerId: ADRIAN,
      recipientId: KLYDE,
      type: "expense",
      transactionDate: "2026-10-04",
      notes: "2 nights",
    });
  });

  it("round-trips a saved row through the server schema unchanged", () => {
    const parsed = transactionInputSchema.parse(toActionInput(TAB, toRowValues(saved)));
    expect(parsed).toMatchObject({
      amountPhpCentavos: saved.amountPhpCentavos,
      foreignAmountMinor: saved.foreignAmountMinor,
      foreignCurrency: "JPY",
      transactionDate: "2026-10-04",
      notes: "2 nights",
    });
  });

  it("detects blank rows, foreign use and changes", () => {
    expect(isBlank(EMPTY_ROW)).toBe(true);
    expect(isBlank({ ...EMPTY_ROW, type: "payment" })).toBe(true);
    expect(isBlank({ ...EMPTY_ROW, amountPhp: " 1 " })).toBe(false);
    expect(hasForeign(EMPTY_ROW)).toBe(false);
    expect(hasForeign({ ...EMPTY_ROW, foreignCurrency: "usd" })).toBe(true);
    expect(sameValues(toRowValues(saved), toRowValues(saved))).toBe(true);
    expect(sameValues(toRowValues(saved), { ...toRowValues(saved), notes: "" })).toBe(false);
  });

  it("accepts only well-formed values from storage", () => {
    expect(parseStoredValues(toRowValues(saved))).toEqual(toRowValues(saved));
    expect(parseStoredValues({ ...toRowValues(saved), type: "gift" })).toBeNull();
    expect(parseStoredValues({ ...toRowValues(saved), amountPhp: 12 })).toBeNull();
    expect(parseStoredValues({ description: "x" })).toBeNull();
    expect(parseStoredValues(null)).toBeNull();
    expect(parseStoredValues("row")).toBeNull();
  });
});

describe("validateRow (browser-side copy of the server rules)", () => {
  const valid = { ...EMPTY_ROW, description: "Mineral Water", amountPhp: "123.03", payerId: ADRIAN, recipientId: KLYDE };

  it("passes a valid row", () => {
    expect(validateRow(TAB, valid)).toBeNull();
  });

  it("reports each problem against its field", () => {
    expect(validateRow(TAB, EMPTY_ROW)).toMatchObject({
      description: "Description is required",
      amountPhp: "Amount is required",
      payerId: "Choose who owes",
      recipientId: "Choose who is owed",
    });
    expect(validateRow(TAB, { ...valid, amountPhp: "0" })).toEqual({ amountPhp: "Amount must be greater than zero" });
    expect(validateRow(TAB, { ...valid, amountPhp: "12.345" })).toEqual({ amountPhp: "Too many decimal places" });
    expect(validateRow(TAB, { ...valid, recipientId: ADRIAN })).toEqual({
      recipientId: "Payer and recipient must be different people",
    });
    expect(validateRow(TAB, { ...valid, foreignCurrency: "USD" })).toEqual({
      foreignAmount: "Enter the foreign amount or clear the currency",
    });
  });
});
