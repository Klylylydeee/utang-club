/**
 * Money helpers. All amounts are integers in minor units (centavos for
 * PHP). Parsing and formatting work on digit strings, and arithmetic is
 * integer-only with overflow checks: no floating-point anywhere.
 */

export const PHP_MINOR_UNITS = 2;

export type ParseMoneyResult =
  | { ok: true; minor: number }
  | { ok: false; reason: "empty" | "malformed" | "too-many-decimals" | "too-large" };

/**
 * Parses a user-typed, non-negative decimal amount into integer minor units.
 *
 * Accepts optional thousands separators and a leading currency sign:
 * "123.03", "1,095", "₱1,095.00", "$2.5" → 12303, 109500, 109500, 250.
 * Rejects negatives, exponents, more decimals than the currency allows,
 * and values beyond Number.MAX_SAFE_INTEGER minor units.
 */
export function parseMoneyToMinor(input: string, minorUnits: number = PHP_MINOR_UNITS): ParseMoneyResult {
  const trimmed = input.trim().replace(/^[₱$€£¥]\s*/, "");
  if (trimmed === "") return { ok: false, reason: "empty" };

  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return { ok: false, reason: "malformed" };

  const whole = match[1].replaceAll(",", "");
  const fraction = match[2] ?? "";
  if (fraction.length > minorUnits) return { ok: false, reason: "too-many-decimals" };

  const value = BigInt(whole + fraction.padEnd(minorUnits, "0"));
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return { ok: false, reason: "too-large" };

  return { ok: true, minor: Number(value) };
}

/** Throws unless `value` is an integer that JavaScript represents exactly. */
export function assertMinorUnits(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer of minor units, got ${value}`);
  }
}

/** Exact integer addition; throws instead of silently losing precision. */
export function addMinor(a: number, b: number): number {
  assertMinorUnits(a);
  assertMinorUnits(b);
  const sum = a + b;
  assertMinorUnits(sum, "sum");
  return sum;
}

/** Exact integer subtraction; throws instead of silently losing precision. */
export function subtractMinor(a: number, b: number): number {
  return addMinor(a, -b);
}

/** Sums a list of minor-unit amounts exactly. */
export function sumMinor(values: readonly number[]): number {
  return values.reduce(addMinor, 0);
}

/**
 * Splits an integer amount into its sign, whole-digit string and
 * fraction-digit string without any floating-point division.
 */
function splitMinor(minor: number, minorUnits: number) {
  assertMinorUnits(minor);
  const digits = Math.abs(minor).toString().padStart(minorUnits + 1, "0");
  const cut = digits.length - minorUnits;
  return {
    negative: minor < 0,
    whole: digits.slice(0, cut),
    fraction: digits.slice(cut),
  };
}

/** Plain decimal string for input fields: 12303 → "123.03", 1500 (JPY) → "1500". */
export function minorToDecimalString(minor: number, minorUnits: number = PHP_MINOR_UNITS): string {
  const { negative, whole, fraction } = splitMinor(minor, minorUnits);
  return `${negative ? "-" : ""}${whole}${minorUnits > 0 ? `.${fraction}` : ""}`;
}

/** UI display format: 1203975 → "₱12,039.75"; negatives → "−₱1.00". */
export function formatPhp(centavos: number): string {
  const { negative, whole, fraction } = splitMinor(centavos, PHP_MINOR_UNITS);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}₱${grouped}.${fraction}`;
}

/**
 * Display format for a foreign amount in its own currency, e.g.
 * (246, "USD") → "$2.46", (1500, "JPY") → "¥1,500". The amount reaches
 * Intl as an exact decimal string, never as a float.
 */
export function formatForeign(minor: number, currency: string, minorUnits: number): string {
  const formatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  });
  // Intl.NumberFormat accepts decimal strings exactly (ES2023); the cast
  // only bridges TypeScript's older lib typing.
  return formatter.format(minorToDecimalString(minor, minorUnits) as unknown as number);
}
