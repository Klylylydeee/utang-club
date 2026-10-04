import { describe, expect, it } from "vitest";
import { calculatePairwiseSettlements } from "@/lib/settlement/calculatePairwiseSettlements";
import { parseMoneyToMinor } from "@/lib/settlement/money";
import type { PairwiseSettlement, SettlementInput } from "@/lib/settlement/types";

// Ids sort in this order on purpose: adrian < klyde < simon < via.
const ADRIAN = "p1-adrian";
const KLYDE = "p2-klyde";
const SIMON = "p3-simon";
const VIA = "p4-via";

let sequence = 0;

/** Builds a row; `php` is a peso string so tests read like the spreadsheet. */
function tx(
  payerId: string,
  recipientId: string,
  php: string,
  options: Partial<Omit<SettlementInput, "payerId" | "recipientId" | "amountPhpCentavos">> = {},
): SettlementInput {
  sequence += 1;
  const parsed = parseMoneyToMinor(php);
  if (!parsed.ok) throw new Error(`bad test amount ${php}`);
  return {
    id: `t${String(sequence).padStart(3, "0")}`,
    type: "expense",
    payerId,
    recipientId,
    amountPhpCentavos: parsed.minor,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
    ...options,
  };
}

function only(settlements: PairwiseSettlement[]): PairwiseSettlement {
  expect(settlements).toHaveLength(1);
  return settlements[0];
}

function outstanding(settlements: PairwiseSettlement[]) {
  return settlements
    .filter((s) => s.status === "outstanding")
    .map((s) => ({ from: s.debtorId, to: s.creditorId, centavos: s.amountPhpCentavos }));
}

describe("calculatePairwiseSettlements — TESTING.md cases", () => {
  it("single obligation: Adrian → Klyde ₱123.03", () => {
    const result = only(calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "123.03")]));
    expect(result).toMatchObject({
      debtorId: ADRIAN,
      creditorId: KLYDE,
      amountPhpCentavos: 12303,
      status: "outstanding",
    });
  });

  it("same-direction aggregation: ₱123.03 + ₱1,301.00 = ₱1,424.03", () => {
    const result = only(calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "123.03"), tx(ADRIAN, KLYDE, "1,301.00")]));
    expect(result).toMatchObject({ debtorId: ADRIAN, creditorId: KLYDE, amountPhpCentavos: 142403 });
  });

  it("reciprocal partial offset: ₱123.03 − ₱100.00 = Adrian → Klyde ₱23.03", () => {
    const result = only(calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "123.03"), tx(KLYDE, ADRIAN, "100.00")]));
    expect(result).toMatchObject({ debtorId: ADRIAN, creditorId: KLYDE, amountPhpCentavos: 2303 });
  });

  it("reciprocal reversal: ₱100.00 vs ₱150.00 = Klyde → Adrian ₱50.00", () => {
    const result = only(calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "100.00"), tx(KLYDE, ADRIAN, "150.00")]));
    expect(result).toMatchObject({ debtorId: KLYDE, creditorId: ADRIAN, amountPhpCentavos: 5000 });
  });

  it("exact cancellation leaves no outstanding settlement, but keeps the pair as settled", () => {
    const rows = [tx(ADRIAN, KLYDE, "100.00"), tx(KLYDE, ADRIAN, "100.00")];
    const result = only(calculatePairwiseSettlements(rows));
    expect(result.status).toBe("settled");
    expect(result.amountPhpCentavos).toBe(0);
    expect(result.transactionIds).toEqual(rows.map((row) => row.id));
  });

  it("multiple independent pairs do not affect each other", () => {
    const adrianKlyde = [tx(ADRIAN, KLYDE, "123.03"), tx(KLYDE, ADRIAN, "100.00")];
    const simonVia = [tx(SIMON, VIA, "500.00"), tx(VIA, SIMON, "750.25")];

    const together = calculatePairwiseSettlements([...simonVia, ...adrianKlyde]);
    expect(outstanding(together)).toEqual([
      { from: ADRIAN, to: KLYDE, centavos: 2303 },
      { from: VIA, to: SIMON, centavos: 25025 },
    ]);
    expect(together).toEqual([
      ...calculatePairwiseSettlements(adrianKlyde),
      ...calculatePairwiseSettlements(simonVia),
    ]);
  });

  it("payment: a full payment zeroes the balance and both source records remain", () => {
    const expense = tx(ADRIAN, KLYDE, "3,885.10");
    const payment = tx(ADRIAN, KLYDE, "3,885.10", { type: "payment" });
    const result = only(calculatePairwiseSettlements([expense, payment]));

    expect(result.status).toBe("settled");
    expect(result.amountPhpCentavos).toBe(0);
    expect(result.transactionIds).toEqual([expense.id, payment.id]);
    expect(result.lineItems.map((item) => item.effectCentavos)).toEqual([388510, -388510]);
  });

  it("centavo precision: no floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 in floats; the centavo equivalent must be exact.
    const result = only(
      calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "0.10"), tx(ADRIAN, KLYDE, "0.20"), tx(KLYDE, ADRIAN, "0.01")]),
    );
    expect(result.amountPhpCentavos).toBe(29);

    const many = Array.from({ length: 1000 }, () => tx(ADRIAN, KLYDE, "0.01"));
    expect(only(calculatePairwiseSettlements(many)).amountPhpCentavos).toBe(1000);

    const mixed = only(
      calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "0.02"), tx(ADRIAN, KLYDE, "123.03"), tx(KLYDE, ADRIAN, "0.01")]),
    );
    expect(mixed.amountPhpCentavos).toBe(12304);
  });
});

describe("calculatePairwiseSettlements — rules", () => {
  it("matches the SETTLEMENT_RULES.md example: ₱1,324.03", () => {
    const result = only(
      calculatePairwiseSettlements([
        tx(ADRIAN, KLYDE, "123.03"),
        tx(ADRIAN, KLYDE, "1,301.00"),
        tx(KLYDE, ADRIAN, "100.00"),
      ]),
    );
    expect(result).toMatchObject({ debtorId: ADRIAN, creditorId: KLYDE, amountPhpCentavos: 132403 });
  });

  it("keeps rows with duplicate descriptions as separate line items", () => {
    const rows = [
      tx(ADRIAN, KLYDE, "50.00"),
      tx(ADRIAN, KLYDE, "50.00"),
      tx(ADRIAN, KLYDE, "50.00"),
    ];
    const result = only(calculatePairwiseSettlements(rows));
    expect(result.amountPhpCentavos).toBe(15000);
    expect(result.lineItems).toHaveLength(3);
    expect(new Set(result.transactionIds).size).toBe(3);
  });

  it("partial payment reduces the balance", () => {
    const result = only(
      calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "3,885.10"), tx(ADRIAN, KLYDE, "1,000.00", { type: "payment" })]),
    );
    expect(result).toMatchObject({ debtorId: ADRIAN, creditorId: KLYDE, amountPhpCentavos: 288510 });
  });

  it("overpayment flips the direction (D1)", () => {
    const result = only(
      calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "100.00"), tx(ADRIAN, KLYDE, "150.00", { type: "payment" })]),
    );
    expect(result).toMatchObject({ debtorId: KLYDE, creditorId: ADRIAN, amountPhpCentavos: 5000 });
  });

  it("a payment in the reverse direction increases the debt", () => {
    // Klyde hands Adrian ₱20 cash: Adrian now owes Klyde that back too.
    const result = only(
      calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "100.00"), tx(KLYDE, ADRIAN, "20.00", { type: "payment" })]),
    );
    expect(result).toMatchObject({ debtorId: ADRIAN, creditorId: KLYDE, amountPhpCentavos: 12000 });
  });

  it("does not simplify debts across people (A→B, B→C stays two settlements)", () => {
    const result = calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "100.00"), tx(KLYDE, SIMON, "100.00")]);
    expect(outstanding(result)).toEqual([
      { from: ADRIAN, to: KLYDE, centavos: 10000 },
      { from: KLYDE, to: SIMON, centavos: 10000 },
    ]);
  });

  it("returns nothing for no transactions", () => {
    expect(calculatePairwiseSettlements([])).toEqual([]);
  });
});

describe("calculatePairwiseSettlements — traceability", () => {
  it("line items carry signed effects and a breakdown that adds up to the balance", () => {
    const rows = [
      tx(ADRIAN, KLYDE, "123.03"),
      tx(KLYDE, ADRIAN, "100.00"),
      tx(ADRIAN, KLYDE, "10.00", { type: "payment" }),
      tx(KLYDE, ADRIAN, "5.00", { type: "payment" }),
    ];
    const result = only(calculatePairwiseSettlements(rows));

    expect(result.lineItems.map((item) => item.effectCentavos)).toEqual([12303, -10000, -1000, 500]);
    expect(result.breakdown).toEqual({
      debtorOwesCentavos: 12303,
      creditorOwesCentavos: 10000,
      debtorPaidCentavos: 1000,
      creditorPaidCentavos: 500,
    });
    const effects = result.lineItems.reduce((sum, item) => sum + item.effectCentavos, 0);
    expect(effects).toBe(result.amountPhpCentavos);
    expect(result.amountPhpCentavos).toBe(1803);
  });

  it("effects are relative to the final direction after a reversal", () => {
    const result = only(calculatePairwiseSettlements([tx(ADRIAN, KLYDE, "100.00"), tx(KLYDE, ADRIAN, "150.00")]));
    expect(result.debtorId).toBe(KLYDE);
    expect(result.lineItems.map((item) => item.effectCentavos)).toEqual([-10000, 15000]);
    expect(result.breakdown).toMatchObject({ debtorOwesCentavos: 15000, creditorOwesCentavos: 10000 });
  });

  it("orders line items by transaction date, then creation time, then id", () => {
    const late = tx(ADRIAN, KLYDE, "1.00", { transactionDate: new Date("2026-03-10") });
    const early = tx(ADRIAN, KLYDE, "2.00", { transactionDate: new Date("2026-03-01") });
    const sameDayA = tx(KLYDE, ADRIAN, "3.00", { transactionDate: new Date("2026-03-05") });
    const sameDayB = tx(ADRIAN, KLYDE, "4.00", { transactionDate: new Date("2026-03-05") });

    const result = only(calculatePairwiseSettlements([late, sameDayB, early, sameDayA]));
    expect(result.transactionIds).toEqual([early.id, sameDayA.id, sameDayB.id, late.id]);
  });

  it("undated rows fall back to their creation time", () => {
    const undated = tx(ADRIAN, KLYDE, "1.00", { createdAt: new Date("2026-03-03T00:00:00Z") });
    const dated = tx(ADRIAN, KLYDE, "2.00", { transactionDate: new Date("2026-03-02T00:00:00Z") });
    const result = only(calculatePairwiseSettlements([undated, dated]));
    expect(result.transactionIds).toEqual([dated.id, undated.id]);
  });
});

describe("calculatePairwiseSettlements — determinism and purity", () => {
  it("gives identical output for any input order", () => {
    const rows = [
      tx(ADRIAN, KLYDE, "123.03"),
      tx(VIA, SIMON, "9.99"),
      tx(KLYDE, ADRIAN, "100.00"),
      tx(SIMON, VIA, "1.00", { type: "payment" }),
      tx(KLYDE, VIA, "42.00"),
    ];
    const expected = calculatePairwiseSettlements(rows);
    expect(calculatePairwiseSettlements([...rows].reverse())).toEqual(expected);
    expect(calculatePairwiseSettlements([rows[2], rows[4], rows[0], rows[3], rows[1]])).toEqual(expected);
  });

  it("does not modify its input", () => {
    const rows = [tx(KLYDE, ADRIAN, "100.00"), tx(ADRIAN, KLYDE, "123.03")];
    const snapshot = structuredClone(rows);
    calculatePairwiseSettlements(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("calculatePairwiseSettlements — invalid input", () => {
  it("rejects self-transactions", () => {
    expect(() => calculatePairwiseSettlements([tx(ADRIAN, ADRIAN, "1.00")])).toThrow(/must differ/);
  });

  it.each([0, -100, 12.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects amount %s", (amount) => {
    const row = { ...tx(ADRIAN, KLYDE, "1.00"), amountPhpCentavos: amount };
    expect(() => calculatePairwiseSettlements([row])).toThrow();
  });

  it("refuses to overflow instead of losing precision", () => {
    const huge = Number.MAX_SAFE_INTEGER;
    const rows = [huge, huge].map((amount) => ({ ...tx(ADRIAN, KLYDE, "1.00"), amountPhpCentavos: amount }));
    expect(() => calculatePairwiseSettlements(rows)).toThrow(RangeError);
  });
});
