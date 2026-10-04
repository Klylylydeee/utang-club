import { describe, expect, it } from "vitest";
import {
  transactionInputSchema,
  transactionRefSchema,
  transactionUpdateSchema,
  type TransactionFormInput,
} from "@/schemas/transaction";

const ADRIAN = "65a000000000000000000001";
const KLYDE = "65a000000000000000000002";
const TAB = "65a0000000000000000000ff";

function row(overrides: Partial<TransactionFormInput> = {}): TransactionFormInput {
  return {
    tabId: TAB,
    description: "Mineral Water",
    amountPhp: "123.03",
    payerId: ADRIAN,
    recipientId: KLYDE,
    ...overrides,
  };
}

function errorPaths(input: TransactionFormInput): string[] {
  const result = transactionInputSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("transactionInputSchema", () => {
  it("accepts a valid expense and converts PHP to centavos", () => {
    const parsed = transactionInputSchema.parse(row());
    expect(parsed).toMatchObject({
      type: "expense",
      description: "Mineral Water",
      amountPhpCentavos: 12303,
      payerId: ADRIAN,
      recipientId: KLYDE,
    });
    expect(parsed.foreignCurrency).toBeUndefined();
  });

  it("keeps foreign amounts in the currency's own minor units", () => {
    expect(transactionInputSchema.parse(row({ foreignCurrency: "usd", foreignAmount: "2.46" }))).toMatchObject({
      foreignCurrency: "USD",
      foreignAmountMinor: 246,
    });
    expect(transactionInputSchema.parse(row({ foreignCurrency: "JPY", foreignAmount: "1500" }))).toMatchObject({
      foreignCurrency: "JPY",
      foreignAmountMinor: 1500,
    });
  });

  it.each(["0", "0.00", "-1", "abc", "1.234", ""])("rejects PHP amount %j", (amountPhp) => {
    expect(errorPaths(row({ amountPhp }))).toContain("amountPhp");
  });

  it("rejects payer == recipient", () => {
    expect(errorPaths(row({ recipientId: ADRIAN }))).toContain("recipientId");
  });

  it("rejects missing payer and recipient", () => {
    expect(errorPaths(row({ payerId: "" }))).toContain("payerId");
    expect(errorPaths(row({ recipientId: "" }))).toContain("recipientId");
  });

  it("rejects malformed ids", () => {
    expect(errorPaths(row({ payerId: '{"$ne":null}' }))).toContain("payerId");
  });

  it("rejects a missing or blank description", () => {
    expect(errorPaths(row({ description: "   " }))).toContain("description");
  });

  it("requires foreign currency and amount together", () => {
    expect(errorPaths(row({ foreignCurrency: "USD" }))).toContain("foreignAmount");
    expect(errorPaths(row({ foreignAmount: "2.00" }))).toContain("foreignCurrency");
    expect(errorPaths(row({ foreignCurrency: "US", foreignAmount: "2.00" }))).toContain("foreignCurrency");
  });

  it("enforces text length limits", () => {
    expect(errorPaths(row({ description: "x".repeat(201) }))).toContain("description");
    expect(errorPaths(row({ notes: "x".repeat(1001) }))).toContain("notes");
  });
});

describe("transactionUpdateSchema", () => {
  const ROW = "65a000000000000000000010";

  it("parses like a new row and keeps the transaction id", () => {
    expect(transactionUpdateSchema.parse({ ...row(), transactionId: ROW })).toMatchObject({
      transactionId: ROW,
      amountPhpCentavos: 12303,
      payerId: ADRIAN,
    });
  });

  it("applies the same validation as a new row", () => {
    const result = transactionUpdateSchema.safeParse({ ...row({ amountPhp: "0", recipientId: ADRIAN }), transactionId: ROW });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["amountPhp", "recipientId"]));
  });

  it("requires a valid transaction id", () => {
    expect(transactionUpdateSchema.safeParse(row()).success).toBe(false);
    expect(transactionUpdateSchema.safeParse({ ...row(), transactionId: '{"$gt":""}' }).success).toBe(false);
    expect(transactionRefSchema.safeParse({ transactionId: ROW }).success).toBe(true);
    expect(transactionRefSchema.safeParse({ transactionId: "nope" }).success).toBe(false);
  });
});
