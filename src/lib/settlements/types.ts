import type { SettlementStatus, TransactionType } from "@/lib/settlement/types";

/** DTOs for the Settlements section. Plain, serializable; all sums done on the server. */

export type SettlementPerson = { id: string; displayName: string };

export type SettlementLine = {
  transactionId: string;
  description: string;
  type: TransactionType;
  /** Relative to the card: does the row run from its debtor to its creditor, or back? */
  direction: "debtor-to-creditor" | "creditor-to-debtor";
  /** The row's own positive amount. */
  amountPhpCentavos: number;
  /** Signed effect on the card's balance: positive adds to the debt, negative reduces it. */
  effectCentavos: number;
  foreignCurrency: string | null;
  foreignAmountMinor: number | null;
  /** `YYYY-MM-DD`, or null. */
  transactionDate: string | null;
};

export type SettlementCard = {
  /** Stable across renders: `debtorId:creditorId`. */
  key: string;
  debtor: SettlementPerson;
  creditor: SettlementPerson;
  status: SettlementStatus;
  /** What the debtor still owes the creditor (0 when settled). */
  amountPhpCentavos: number;
  /** Everything that adds to the debt: expenses debtor→creditor, payments creditor→debtor. */
  owedCentavos: number;
  /** Everything that reduces it: expenses creditor→debtor (offsets), payments debtor→creditor. */
  reducedCentavos: number;
  lines: SettlementLine[];
};

/** One person across all their pairs (sums only; pairs stay the source). */
export type PersonTotalView = {
  person: SettlementPerson;
  owesCentavos: number;
  owedCentavos: number;
  /** owed − owes: positive means they get money back. */
  netCentavos: number;
};

export type SettlementSummary = {
  /** Display order: debtor name, then creditor name. */
  outstanding: SettlementCard[];
  settled: SettlementCard[];
  /** Everyone in the tab, in name order. */
  people: PersonTotalView[];
};
