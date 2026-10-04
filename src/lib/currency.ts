/**
 * ISO 4217 minor-unit exponents for currencies whose exponent is not 2
 * (decision D3). Foreign amounts are display-only; they never enter
 * settlement arithmetic.
 */
const NON_DEFAULT_MINOR_UNITS: Readonly<Record<string, number>> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  CLF: 4, UYW: 4,
};

const DEFAULT_MINOR_UNITS = 2;

export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/** Number of decimal places for a currency (e.g. JPY → 0, USD → 2, KWD → 3). */
export function minorUnitsFor(currencyCode: string): number {
  return NON_DEFAULT_MINOR_UNITS[currencyCode.toUpperCase()] ?? DEFAULT_MINOR_UNITS;
}
