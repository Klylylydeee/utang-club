import { describe, expect, it } from "vitest";
import { buildSettlementSummary } from "@/lib/settlements/buildSettlementSummary";
import { buildSettlementCsv, csvCell } from "@/lib/settlements/settlementCsv";
import { buildShareModel, exportFileName, SHARE_LINE_LIMIT } from "@/lib/settlements/shareModel";
import type { TransactionRow } from "@/lib/transactions/types";

const PEOPLE = [
  { id: "65a000000000000000000002", displayName: "Klyde" },
  { id: "65a000000000000000000001", displayName: "Adrian" },
  { id: "65a000000000000000000003", displayName: "Simon" },
];
const [KLYDE, ADRIAN, SIMON] = PEOPLE.map((person) => person.id);
// 2026-10-03 23:30 UTC is already 4 October in Manila.
const NOW = new Date(Date.UTC(2026, 9, 3, 23, 30));

let seq = 0;
function row(payerId: string, recipientId: string, amountPhpCentavos: number, extra: Partial<TransactionRow> = {}): TransactionRow {
  seq += 1;
  return {
    id: `65a0000000000000000003${String(seq).padStart(2, "0")}`,
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
    addedBy: null,
    editedBy: null,
    ...extra,
  };
}

describe("buildShareModel", () => {
  it("shows outstanding pairs and non-zero nets, formatted, dated in Manila", () => {
    const summary = buildSettlementSummary(
      [row(ADRIAN, KLYDE, 12303), row(KLYDE, ADRIAN, 10000), row(SIMON, ADRIAN, 218050), row(KLYDE, SIMON, 500), row(SIMON, KLYDE, 500)],
      PEOPLE,
    );
    const model = buildShareModel("Japan trip", summary, NOW);
    expect(model.asOf).toBe("as of 4 October 2026");
    expect(model.pairs.map((pair) => `${pair.from} → ${pair.to} ${pair.amount}`)).toEqual([
      "Adrian → Klyde ₱23.03",
      "Simon → Adrian ₱2,180.50",
    ]);
    expect(model.nets.map((net) => `${net.name} ${net.verb} ${net.amount}`)).toEqual([
      "Adrian gets back ₱2,157.47",
      "Klyde gets back ₱23.03",
      "Simon pays ₱2,180.50",
    ]);
    expect(model.morePairs).toBe(0);
    expect(model.footer).toBe("1 settled pair · Made with Utang Club");
  });

  it("leaves out square people and has no pairs when everyone is square", () => {
    const summary = buildSettlementSummary([row(ADRIAN, KLYDE, 100), row(KLYDE, ADRIAN, 100)], PEOPLE);
    const model = buildShareModel("Dinner", summary, NOW);
    expect(model.pairs).toEqual([]);
    expect(model.nets).toEqual([]);
    expect(model.footer).toBe("1 settled pair · Made with Utang Club");
  });

  it("caps long lists and counts the rest", () => {
    const people = Array.from({ length: 30 }, (_, index) => ({
      id: `65a0000000000000000010${String(index).padStart(2, "0")}`,
      displayName: `P${String(index).padStart(2, "0")}`,
    }));
    const [creditor, ...debtors] = people;
    const summary = buildSettlementSummary(
      debtors.map((debtor) => row(debtor.id, creditor.id, 100)),
      people,
    );
    const model = buildShareModel("Big night", summary, NOW);
    expect(model.pairs).toHaveLength(SHARE_LINE_LIMIT);
    expect(model.morePairs).toBe(29 - SHARE_LINE_LIMIT);
    expect(model.nets).toHaveLength(SHARE_LINE_LIMIT);
    expect(model.morePeople).toBe(30 - SHARE_LINE_LIMIT);
    expect(model.footer).toBe("Made with Utang Club");
  });
});

describe("exportFileName", () => {
  it("slugs the tab name to ASCII and adds the Manila date", () => {
    expect(exportFileName("Japan Trip — Osaka!", "png", NOW)).toBe("utang-club-japan-trip-osaka-2026-10-04.png");
    expect(exportFileName("Café ñ", "csv", NOW)).toBe("utang-club-cafe-n-2026-10-04.csv");
    expect(exportFileName("日本", "png", NOW)).toBe("utang-club-2026-10-04.png");
    expect(exportFileName('a"b\r\nc', "csv", NOW)).toBe("utang-club-a-b-c-2026-10-04.csv");
  });
});

describe("csvCell", () => {
  it("quotes per RFC 4180", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(" padded ")).toBe('" padded "');
  });

  it("neutralises formulas in user text", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell("1234.56")).toBe("1234.56");
  });
});

describe("buildSettlementCsv", () => {
  it("lists every row with names and exact decimals, then each pair", () => {
    const rows = [
      row(ADRIAN, KLYDE, 12303, {
        description: "Mineral Water",
        foreignCurrency: "USD",
        foreignAmountMinor: 246,
        transactionDate: "2026-10-02",
        // The CSV names people even when the reader is the author: no "you".
        addedBy: { name: "Bea", isYou: true },
        editedBy: { name: "Dave, Jr.", isYou: false },
      }),
      row(KLYDE, ADRIAN, 10000, { description: "=cmd", notes: "said \"thanks\"" }),
      row(SIMON, KLYDE, 150000, { description: "Hotel", foreignCurrency: "JPY", foreignAmountMinor: 4000 }),
      row(SIMON, KLYDE, 150000, { type: "payment", description: "GCash" }),
    ];
    const csv = buildSettlementCsv(rows, PEOPLE, buildSettlementSummary(rows, PEOPLE));
    expect(csv.split("\r\n")).toEqual([
      "Date,Description,Type,To pay,To be paid,Amount (PHP),Foreign currency,Foreign amount,Notes,Added by,Edited by",
      '2026-10-02,Mineral Water,Expense,Adrian,Klyde,123.03,USD,2.46,,Bea,"Dave, Jr."',
      `2026-10-01,'=cmd,Expense,Klyde,Adrian,100.00,,,"said ""thanks""",,`,
      "2026-10-01,Hotel,Expense,Simon,Klyde,1500.00,JPY,4000,,,",
      "2026-10-01,GCash,Payment,Simon,Klyde,1500.00,,,,,",
      "",
      "To pay,To be paid,Outstanding (PHP),Status",
      "Adrian,Klyde,23.03,Outstanding",
      "Klyde,Simon,0.00,Settled",
      "",
    ]);
  });
});
