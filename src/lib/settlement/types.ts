/**
 * Framework-independent settlement types (ARCHITECTURE.md, extended per
 * decision D2). No React, Mongoose or ObjectId here: ids are strings.
 */

export type TransactionType = "expense" | "payment";

/** One canonical transaction row, as the engine sees it. */
export type SettlementInput = {
  id: string;
  type: TransactionType;
  /** The debtor for an expense; the person paying for a payment. */
  payerId: string;
  /** The creditor for an expense; the person being paid for a payment. */
  recipientId: string;
  /** Positive integer centavos. */
  amountPhpCentavos: number;
  transactionDate?: Date | null;
  createdAt: Date;
};

/** A contributing row, expressed relative to the settlement's direction. */
export type SettlementLineItem = {
  transactionId: string;
  type: TransactionType;
  payerId: string;
  recipientId: string;
  /** The row's own (always positive) amount. */
  amountPhpCentavos: number;
  /**
   * Signed effect on what the debtor owes the creditor: positive increases
   * the debt, negative offsets it (reciprocal expenses and payments).
   */
  effectCentavos: number;
};

export type SettlementBreakdown = {
  /** Expenses where the debtor owes the creditor. */
  debtorOwesCentavos: number;
  /** Expenses where the creditor owes the debtor (offsets). */
  creditorOwesCentavos: number;
  /** Payments from the debtor to the creditor (offsets). */
  debtorPaidCentavos: number;
  /** Payments from the creditor to the debtor (increase the debt). */
  creditorPaidCentavos: number;
};

export type SettlementStatus = "outstanding" | "settled";

export type PairwiseSettlement = {
  /**
   * Who owes. For a settled pair (amount 0) there is no real direction;
   * debtor/creditor is then only a stable ordering of the two people.
   */
  debtorId: string;
  creditorId: string;
  /** Net amount owed; always ≥ 0. Zero means settled. */
  amountPhpCentavos: number;
  status: SettlementStatus;
  /** Contributing rows in display order (see calculatePairwiseSettlements). */
  transactionIds: string[];
  lineItems: SettlementLineItem[];
  breakdown: SettlementBreakdown;
};
