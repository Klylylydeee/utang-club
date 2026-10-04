import type { TransactionType } from "@/lib/settlement/types";
import type { AuthorRef } from "./authorship";

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
  /** Who added the row (null for rows from before this was recorded). */
  addedBy: AuthorRef | null;
  /** Who last changed a field, if anyone did after it was added. */
  editedBy: AuthorRef | null;
};

/** A deleted row, for the "Recently deleted" list. */
export type DeletedTransactionRow = TransactionRow & {
  /** ISO 8601. */
  deletedAt: string;
  deletedBy: AuthorRef | null;
};
