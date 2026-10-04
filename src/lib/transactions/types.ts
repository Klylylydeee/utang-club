import type { TransactionType } from "@/lib/settlement/types";

/** One transaction row as sent to the UI. Plain, serializable, no ObjectIds. */
export type TransactionRow = {
  id: string;
  type: TransactionType;
  description: string;
  foreignCurrency: string | null;
  /** In the foreign currency's own minor units (decision D3). Display only. */
  foreignAmountMinor: number | null;
  /** Positive integer centavos. */
  amountPhpCentavos: number;
  /** Who owes (expense) or who pays (payment). */
  payerId: string;
  /** Who is owed (expense) or who is paid (payment). */
  recipientId: string;
  /** `YYYY-MM-DD`, or null when not set. */
  transactionDate: string | null;
  notes: string | null;
  /** ISO 8601. */
  createdAt: string;
};
