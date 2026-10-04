import { describe, expect, it } from "vitest";
import { buildSettlementSummary, toSettlementInput } from "@/lib/settlements/buildSettlementSummary";
import type { TransactionRow } from "@/lib/transactions/types";

const ADRIAN = "65a000000000000000000001";
const KLYDE = "65a000000000000000000002";
const SIMON = "65a000000000000000000003";
const VIA = "65a000000000000000000004";
const PEOPLE = [
  { id: KLYDE, displayName: "Klyde" },
  { id: ADRIAN, displayName: "Adrian" },
  { id: SIMON, displayName: "Simon" },
  { id: VIA, displayName: "Via" },
];

let seq = 0;
function row(
  payerId: string,
  recipientId: string,
  amountPhpCentavos: number,
  extra: Partial<TransactionRow> = {},
): TransactionRow {
  seq += 1;
  return {
    id: `65a0000000000000000001${String(seq).padStart(2, "0")}`,
    type: "expense",
    description: `Row ${seq}`,
    foreignCurrency: null,
    foreignAmountMinor: null,
    amountPhpCentavos,
    payerId,
    recipientId,
    transactionDate: null,
    notes: null,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, seq)).toISOString(),
    ...extra,
  };
}

describe("buildSettlementSummary", () => {
  it("criterion 1: Adrian owes Klyde ₱123.03", () => {
    const { outstanding, settled } = buildSettlementSummary([row(ADRIAN, KLYDE, 12303)], PEOPLE);
    expect(settled).toEqual([]);
    expect(outstanding).toMatchObject([
      {
        debtor: { id: ADRIAN, displayName: "Adrian" },
        creditor: { id: KLYDE, displayName: "Klyde" },
        amountPhpCentavos: 12303,
        owedCentavos: 12303,
        reducedCentavos: 0,
        status: "outstanding",
      },
    ]);
  });

  it("criteria 2 and 6: a reverse expense offsets, and every row is listed with its effect", () => {
    const water = row(ADRIAN, KLYDE, 12303, { description: "Mineral Water" });
    const back = row(KLYDE, ADRIAN, 10000, { description: "Mineral Water" }); // duplicate description is fine
    const [card] = buildSettlementSummary([back, water], PEOPLE).outstanding;

    expect(card).toMatchObject({ amountPhpCentavos: 2303, owedCentavos: 12303, reducedCentavos: 10000 });
    expect(card.lines).toEqual([
      expect.objectContaining({ transactionId: water.id, direction: "debtor-to-creditor", effectCentavos: 12303 }),
      expect.objectContaining({ transactionId: back.id, direction: "creditor-to-debtor", effectCentavos: -10000 }),
    ]);
  });

  it("follows a reversal to the final direction", () => {
    const [card] = buildSettlementSummary([row(ADRIAN, KLYDE, 10000), row(KLYDE, ADRIAN, 15000)], PEOPLE).outstanding;
    expect(card).toMatchObject({ debtor: { id: KLYDE }, creditor: { id: ADRIAN }, amountPhpCentavos: 5000 });
  });

  it("criterion 3: equal reciprocal amounts are settled, with their history kept", () => {
    const { outstanding, settled } = buildSettlementSummary(
      [row(KLYDE, ADRIAN, 10000), row(ADRIAN, KLYDE, 10000)],
      PEOPLE,
    );
    expect(outstanding).toEqual([]);
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ status: "settled", amountPhpCentavos: 0, debtor: { displayName: "Adrian" } });
    expect(settled[0].lines).toHaveLength(2);
  });

  it("payments reduce the debt; a payment the other way adds to it", () => {
    const expense = row(ADRIAN, KLYDE, 388510);
    const paid = row(ADRIAN, KLYDE, 100000, { type: "payment" });
    const reverse = row(KLYDE, ADRIAN, 5000, { type: "payment" });
    const [card] = buildSettlementSummary([expense, paid, reverse], PEOPLE).outstanding;

    expect(card.amountPhpCentavos).toBe(293510);
    expect(card.owedCentavos).toBe(393510);
    expect(card.reducedCentavos).toBe(100000);
    expect(card.lines.map((line) => [line.type, line.direction, line.effectCentavos])).toEqual([
      ["expense", "debtor-to-creditor", 388510],
      ["payment", "debtor-to-creditor", -100000],
      ["payment", "creditor-to-debtor", 5000],
    ]);
  });

  it("a full payment settles the pair without dropping the expense", () => {
    const { outstanding, settled } = buildSettlementSummary(
      [row(ADRIAN, KLYDE, 388510), row(ADRIAN, KLYDE, 388510, { type: "payment" })],
      PEOPLE,
    );
    expect(outstanding).toEqual([]);
    expect(settled[0].lines.map((line) => line.type)).toEqual(["expense", "payment"]);
  });

  it("keeps pairs separate and orders cards by debtor, then creditor name", () => {
    const { outstanding } = buildSettlementSummary(
      [row(VIA, SIMON, 1), row(SIMON, ADRIAN, 2), row(ADRIAN, VIA, 3), row(ADRIAN, KLYDE, 4)],
      PEOPLE,
    );
    expect(
      outstanding.map((card) => `${card.debtor.displayName}→${card.creditor.displayName}:${card.amountPhpCentavos}`),
    ).toEqual(["Adrian→Klyde:4", "Adrian→Via:3", "Simon→Adrian:2", "Via→Simon:1"]);
  });

  it("stays exact to the centavo", () => {
    const rows = [row(ADRIAN, KLYDE, 1), row(ADRIAN, KLYDE, 2), row(ADRIAN, KLYDE, 12303), row(KLYDE, ADRIAN, 1)];
    expect(buildSettlementSummary(rows, PEOPLE).outstanding[0].amountPhpCentavos).toBe(12305);
  });

  it("uses current display names and carries foreign amounts for display", () => {
    const renamed = PEOPLE.map((person) => (person.id === ADRIAN ? { ...person, displayName: "Adrian G." } : person));
    const [card] = buildSettlementSummary(
      [row(ADRIAN, KLYDE, 5878050, { foreignCurrency: "JPY", foreignAmountMinor: 150000, transactionDate: "2026-10-02" })],
      renamed,
    ).outstanding;
    expect(card.debtor.displayName).toBe("Adrian G.");
    expect(card.lines[0]).toMatchObject({ foreignCurrency: "JPY", foreignAmountMinor: 150000, transactionDate: "2026-10-02" });
  });

  it("orders line items by date, falling back to entry time", () => {
    const late = row(ADRIAN, KLYDE, 1, { transactionDate: "2026-10-20" });
    const early = row(ADRIAN, KLYDE, 2, { transactionDate: "2026-09-01" });
    const undated = row(ADRIAN, KLYDE, 3); // created 2026-10-01
    const [card] = buildSettlementSummary([late, early, undated], PEOPLE).outstanding;
    expect(card.lines.map((line) => line.transactionId)).toEqual([early.id, undated.id, late.id]);
  });

  it("maps a row to engine input with real dates", () => {
    const input = toSettlementInput(row(ADRIAN, KLYDE, 1, { transactionDate: "2026-10-04" }));
    expect(input.transactionDate?.toISOString()).toBe("2026-10-04T00:00:00.000Z");
    expect(input.createdAt).toBeInstanceOf(Date);
  });
});
