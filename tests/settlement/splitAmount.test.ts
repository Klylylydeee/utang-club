import { describe, expect, it } from "vitest";
import { sumMinor } from "@/lib/settlement/money";
import { splitAmount } from "@/lib/settlement/splitAmount";

// Participants are passed in display-name order by the caller.
const ADRIAN = "a";
const KLYDE = "k";
const SIMON = "s";
const VIA = "v";

describe("splitAmount (SETTLEMENT_RULES.md → Splitting a bill)", () => {
  it("rule example: ₱100.00 three ways, Klyde paid → Adrian ₱33.34, Simon ₱33.33", () => {
    expect(splitAmount(10000, [ADRIAN, KLYDE, SIMON], KLYDE)).toEqual({
      ok: true,
      debts: [
        { personId: ADRIAN, amountPhpCentavos: 3334 },
        { personId: SIMON, amountPhpCentavos: 3333 },
      ],
      payerShareCentavos: 3333,
    });
  });

  it("splits evenly when it divides: ₱3,000 for four → three rows of ₱750", () => {
    const result = splitAmount(300000, [ADRIAN, KLYDE, SIMON, VIA], KLYDE);
    expect(result).toMatchObject({ ok: true, payerShareCentavos: 75000 });
    expect(result.ok && result.debts.map((debt) => debt.amountPhpCentavos)).toEqual([75000, 75000, 75000]);
  });

  it("gives leftover centavos to debtors in order, never to the payer", () => {
    // ₱1.03 four ways: share 25, leftover 3 → the three debtors get 26 each; payer keeps 25.
    const result = splitAmount(103, [ADRIAN, KLYDE, SIMON, VIA], ADRIAN);
    expect(result).toEqual({
      ok: true,
      debts: [
        { personId: KLYDE, amountPhpCentavos: 26 },
        { personId: SIMON, amountPhpCentavos: 26 },
        { personId: VIA, amountPhpCentavos: 26 },
      ],
      payerShareCentavos: 25,
    });
  });

  it("works when the payer is not a participant", () => {
    const result = splitAmount(10001, [ADRIAN, SIMON], KLYDE);
    expect(result).toEqual({
      ok: true,
      debts: [
        { personId: ADRIAN, amountPhpCentavos: 5001 },
        { personId: SIMON, amountPhpCentavos: 5000 },
      ],
      payerShareCentavos: null,
    });
    // The payer recovers the full total.
    expect(result.ok && sumMinor(result.debts.map((debt) => debt.amountPhpCentavos))).toBe(10001);
  });

  it("debts plus the payer's share always equal the total, to the centavo", () => {
    for (const total of [1, 2, 3, 99, 100, 101, 12303, 388510, 999_999_999]) {
      for (const people of [[ADRIAN, KLYDE], [ADRIAN, KLYDE, SIMON], [ADRIAN, KLYDE, SIMON, VIA]]) {
        const result = splitAmount(total, people, KLYDE);
        if (!result.ok) continue;
        const debts = result.debts.map((debt) => debt.amountPhpCentavos);
        expect(sumMinor([...debts, result.payerShareCentavos ?? 0])).toBe(total);
        expect(Math.max(...debts) - Math.min(...debts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rejects splits with nobody to owe the payer, or a ₱0.00 share", () => {
    expect(splitAmount(10000, [KLYDE], KLYDE)).toEqual({ ok: false, reason: "no-debtors" });
    expect(splitAmount(2, [ADRIAN, KLYDE, SIMON], KLYDE)).toEqual({ ok: false, reason: "too-small" });
    expect(splitAmount(3, [ADRIAN, KLYDE, SIMON], KLYDE)).toMatchObject({ ok: true });
  });

  it("throws on programming errors", () => {
    expect(() => splitAmount(0, [ADRIAN, KLYDE], KLYDE)).toThrow(RangeError);
    expect(() => splitAmount(1.5, [ADRIAN, KLYDE], KLYDE)).toThrow(RangeError);
    expect(() => splitAmount(100, [ADRIAN, ADRIAN, KLYDE], KLYDE)).toThrow(RangeError);
  });
});
