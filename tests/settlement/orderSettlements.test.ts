import { describe, expect, it } from "vitest";
import { calculatePairwiseSettlements } from "@/lib/settlement/calculatePairwiseSettlements";
import { orderSettlements } from "@/lib/settlement/orderSettlements";
import type { SettlementInput } from "@/lib/settlement/types";

// Ids deliberately sort in a different order from the display names.
const people = new Map([
  ["z-adrian", "Adrian"],
  ["y-klyde", "Klyde"],
  ["x-simon", "simon"],
  ["w-via", "Via"],
]);

let sequence = 0;
function tx(payerId: string, recipientId: string, centavos: number, type: SettlementInput["type"] = "expense") {
  sequence += 1;
  return {
    id: `t${sequence}`,
    type,
    payerId,
    recipientId,
    amountPhpCentavos: centavos,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
  } satisfies SettlementInput;
}

describe("orderSettlements", () => {
  it("sorts by debtor name, then creditor name, ignoring case", () => {
    const settlements = calculatePairwiseSettlements([
      tx("w-via", "z-adrian", 100),
      tx("z-adrian", "x-simon", 100),
      tx("z-adrian", "y-klyde", 100),
      tx("x-simon", "y-klyde", 100),
    ]);
    const ordered = orderSettlements(settlements, people).map(
      (s) => `${people.get(s.debtorId)} → ${people.get(s.creditorId)}`,
    );
    expect(ordered).toEqual(["Adrian → Klyde", "Adrian → simon", "simon → Klyde", "Via → Adrian"]);
  });

  it("orients a settled pair alphabetically and flips its effects consistently", () => {
    const settlements = calculatePairwiseSettlements([
      tx("y-klyde", "z-adrian", 500),
      tx("z-adrian", "y-klyde", 500),
      tx("z-adrian", "y-klyde", 200, "payment"),
      tx("y-klyde", "z-adrian", 200, "payment"),
    ]);
    expect(settlements[0].debtorId).toBe("y-klyde"); // engine orders by id

    const [settled] = orderSettlements(settlements, people);
    expect(settled.status).toBe("settled");
    expect(settled.debtorId).toBe("z-adrian");
    expect(settled.creditorId).toBe("y-klyde");
    expect(settled.lineItems.map((item) => item.effectCentavos)).toEqual([-500, 500, -200, 200]);
    expect(settled.breakdown).toEqual({
      debtorOwesCentavos: 500,
      creditorOwesCentavos: 500,
      debtorPaidCentavos: 200,
      creditorPaidCentavos: 200,
    });
  });

  it("never reorients an outstanding settlement", () => {
    const [settlement] = orderSettlements(calculatePairwiseSettlements([tx("w-via", "z-adrian", 100)]), people);
    expect(settlement.debtorId).toBe("w-via");
    expect(settlement.creditorId).toBe("z-adrian");
  });

  it("does not modify its input", () => {
    const settlements = calculatePairwiseSettlements([tx("y-klyde", "z-adrian", 5), tx("z-adrian", "y-klyde", 5)]);
    const snapshot = structuredClone(settlements);
    orderSettlements(settlements, people);
    expect(settlements).toEqual(snapshot);
  });

  it("falls back to ids for unknown people and breaks name ties by id", () => {
    const twins = new Map([
      ["b", "Sam"],
      ["a", "sam"],
      ["c", "Zed"],
    ]);
    const ordered = orderSettlements(calculatePairwiseSettlements([tx("b", "c", 1), tx("a", "c", 1)]), twins);
    expect(ordered.map((s) => s.debtorId)).toEqual(["a", "b"]);
    expect(orderSettlements(calculatePairwiseSettlements([tx("q", "r", 1)]), new Map())[0].debtorId).toBe("q");
  });
});
