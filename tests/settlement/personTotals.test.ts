import { describe, expect, it } from "vitest";
import { calculatePairwiseSettlements } from "@/lib/settlement/calculatePairwiseSettlements";
import { balanceBetween, calculatePersonTotals } from "@/lib/settlement/personTotals";
import type { SettlementInput } from "@/lib/settlement/types";

let seq = 0;
function tx(payerId: string, recipientId: string, amountPhpCentavos: number, type: SettlementInput["type"] = "expense") {
  seq += 1;
  return { id: `t${seq}`, type, payerId, recipientId, amountPhpCentavos, createdAt: new Date(seq) } satisfies SettlementInput;
}

describe("calculatePersonTotals", () => {
  it("adds each person's pairs without moving debt between people", () => {
    // A owes B 100, B owes C 30 (stays two debts: no A → C simplification), C owes A 5.
    const settlements = calculatePairwiseSettlements([tx("A", "B", 100), tx("B", "C", 30), tx("C", "A", 5)]);
    expect(calculatePersonTotals(settlements, ["A", "B", "C", "D"])).toEqual([
      { personId: "A", owesCentavos: 100, owedCentavos: 5, netCentavos: -95 },
      { personId: "B", owesCentavos: 30, owedCentavos: 100, netCentavos: 70 },
      { personId: "C", owesCentavos: 5, owedCentavos: 30, netCentavos: 25 },
      { personId: "D", owesCentavos: 0, owedCentavos: 0, netCentavos: 0 },
    ]);
  });

  it("uses the netted pair amounts and ignores settled pairs", () => {
    const settlements = calculatePairwiseSettlements([
      tx("A", "B", 12303),
      tx("B", "A", 10000),
      tx("A", "C", 500),
      tx("A", "C", 500, "payment"),
    ]);
    expect(calculatePersonTotals(settlements, ["A", "B", "C"])).toEqual([
      { personId: "A", owesCentavos: 2303, owedCentavos: 0, netCentavos: -2303 },
      { personId: "B", owesCentavos: 0, owedCentavos: 2303, netCentavos: 2303 },
      { personId: "C", owesCentavos: 0, owedCentavos: 0, netCentavos: 0 },
    ]);
  });

  it("nets always sum to zero", () => {
    const settlements = calculatePairwiseSettlements([tx("A", "B", 1), tx("C", "B", 7), tx("D", "A", 13), tx("B", "D", 2)]);
    const nets = calculatePersonTotals(settlements, ["A", "B", "C", "D"]).map((total) => total.netCentavos);
    expect(nets.reduce((sum, net) => sum + net, 0)).toBe(0);
  });
});

describe("balanceBetween", () => {
  it("is signed by direction and 0 for settled or unrelated pairs", () => {
    const settlements = calculatePairwiseSettlements([tx("A", "B", 300), tx("C", "D", 5), tx("D", "C", 5)]);
    expect(balanceBetween(settlements, "A", "B")).toBe(300);
    expect(balanceBetween(settlements, "B", "A")).toBe(-300);
    expect(balanceBetween(settlements, "C", "D")).toBe(0);
    expect(balanceBetween(settlements, "A", "C")).toBe(0);
  });
});
