import { describe, expect, it } from "vitest";
import { buildSettlementSummary } from "@/lib/settlements/buildSettlementSummary";
import { buildSummaryText, describeNet } from "@/lib/settlements/summaryText";
import type { TransactionRow } from "@/lib/transactions/types";

const PEOPLE = [
  { id: "65a000000000000000000002", displayName: "Klyde" },
  { id: "65a000000000000000000001", displayName: "Adrian" },
  { id: "65a000000000000000000003", displayName: "Simon" },
];
const [KLYDE, ADRIAN, SIMON] = PEOPLE.map((person) => person.id);

let seq = 0;
function row(payerId: string, recipientId: string, amountPhpCentavos: number): TransactionRow {
  seq += 1;
  return {
    id: `65a0000000000000000002${String(seq).padStart(2, "0")}`,
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
  };
}

describe("per-person totals in the summary", () => {
  it("lists everyone in name order with what they owe, are owed and net", () => {
    const summary = buildSettlementSummary(
      [row(ADRIAN, KLYDE, 12303), row(KLYDE, ADRIAN, 10000), row(SIMON, ADRIAN, 218050)],
      PEOPLE,
    );
    expect(summary.people.map((total) => [total.person.displayName, total.owesCentavos, total.owedCentavos, total.netCentavos])).toEqual([
      ["Adrian", 2303, 218050, 215747],
      ["Klyde", 0, 2303, 2303],
      ["Simon", 218050, 0, -218050],
    ]);
  });
});

describe("buildSummaryText", () => {
  it("lists outstanding pairs and each person's net", () => {
    const summary = buildSettlementSummary(
      [row(ADRIAN, KLYDE, 12303), row(KLYDE, ADRIAN, 10000), row(SIMON, ADRIAN, 218050)],
      PEOPLE,
    );
    expect(buildSummaryText("October 2026", summary)).toBe(
      [
        "October 2026 · Utang Club",
        "",
        "Adrian → Klyde: ₱23.03",
        "Simon → Adrian: ₱2,180.50",
        "",
        "Per person",
        "Adrian: gets back ₱2,157.47",
        "Klyde: gets back ₱23.03",
        "Simon: pays ₱2,180.50",
      ].join("\n"),
    );
  });

  it("says everyone is square when nothing is outstanding", () => {
    const summary = buildSettlementSummary([row(ADRIAN, KLYDE, 100), row(KLYDE, ADRIAN, 100)], PEOPLE);
    expect(buildSummaryText("Oct", summary)).toBe("Oct · Utang Club\n\nEveryone is square. Nothing is outstanding.");
  });

  it("describes a net by its sign only", () => {
    expect(describeNet(0)).toBe("square");
    expect(describeNet(1)).toBe("gets back ₱0.01");
    expect(describeNet(-12303)).toBe("pays ₱123.03");
  });
});
