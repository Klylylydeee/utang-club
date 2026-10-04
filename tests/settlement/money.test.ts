import { describe, expect, it } from "vitest";
import {
  addMinor,
  formatForeign,
  formatPhp,
  minorToDecimalString,
  parseMoneyToMinor,
  subtractMinor,
  sumMinor,
} from "@/lib/settlement/money";

describe("parseMoneyToMinor", () => {
  it.each([
    ["123.03", 12303],
    ["1,095.00", 109500],
    ["1095", 109500],
    ["₱12,039.75", 1203975],
    ["0.01", 1],
    ["0.02", 2],
    ["2.5", 250],
    ["  7 ", 700],
  ])("parses %s as %i centavos", (input, expected) => {
    expect(parseMoneyToMinor(input)).toEqual({ ok: true, minor: expected });
  });

  it("parses zero (sign rules are enforced by schemas, not the parser)", () => {
    expect(parseMoneyToMinor("0.00")).toEqual({ ok: true, minor: 0 });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["-5", "malformed"],
    ["1e3", "malformed"],
    ["12.", "malformed"],
    [".5", "malformed"],
    ["1,23.00", "malformed"],
    ["12,3456", "malformed"],
    ["abc", "malformed"],
    ["NaN", "malformed"],
    ["1.234", "too-many-decimals"],
    ["99999999999999999", "too-large"],
  ])("rejects %j as %s", (input, reason) => {
    expect(parseMoneyToMinor(input)).toEqual({ ok: false, reason });
  });

  it("respects currency minor units", () => {
    expect(parseMoneyToMinor("1500", 0)).toEqual({ ok: true, minor: 1500 });
    expect(parseMoneyToMinor("1500.5", 0)).toEqual({ ok: false, reason: "too-many-decimals" });
    expect(parseMoneyToMinor("1.234", 3)).toEqual({ ok: true, minor: 1234 });
  });
});

describe("integer arithmetic", () => {
  it("adds, subtracts and sums exactly", () => {
    expect(addMinor(10, 20)).toBe(30);
    expect(subtractMinor(12303, 10000)).toBe(2303);
    expect(sumMinor([1, 2, 12303])).toBe(12306);
    expect(sumMinor([])).toBe(0);
  });

  it("rejects non-integers and overflow", () => {
    expect(() => addMinor(0.1, 0.2)).toThrow(RangeError);
    expect(() => addMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
    expect(() => sumMinor([Number.NaN])).toThrow(RangeError);
  });
});

describe("formatPhp", () => {
  it.each([
    [0, "₱0.00"],
    [1, "₱0.01"],
    [12303, "₱123.03"],
    [109500, "₱1,095.00"],
    [388510, "₱3,885.10"],
    [1203975, "₱12,039.75"],
    [123456789012, "₱1,234,567,890.12"],
    [-100, "−₱1.00"],
  ])("formats %i as %s", (centavos, expected) => {
    expect(formatPhp(centavos)).toBe(expected);
  });

  it("is exact at the largest safe integer", () => {
    expect(formatPhp(Number.MAX_SAFE_INTEGER)).toBe("₱90,071,992,547,409.91");
  });

  it("refuses non-integer input", () => {
    expect(() => formatPhp(123.03)).toThrow(RangeError);
  });
});

describe("minorToDecimalString", () => {
  it("round-trips with parseMoneyToMinor", () => {
    for (const [minor, units] of [[12303, 2], [5, 2], [0, 2], [1500, 0], [1234, 3]] as const) {
      const text = minorToDecimalString(minor, units);
      expect(parseMoneyToMinor(text, units)).toEqual({ ok: true, minor });
    }
    expect(minorToDecimalString(5)).toBe("0.05");
    expect(minorToDecimalString(1500, 0)).toBe("1500");
  });
});

describe("formatForeign", () => {
  it("formats in the currency's own minor units", () => {
    expect(formatForeign(246, "USD", 2)).toContain("2.46");
    expect(formatForeign(1500, "JPY", 0)).toMatch(/1,500$/);
    expect(formatForeign(1234, "KWD", 3)).toContain("1.234");
  });
});
