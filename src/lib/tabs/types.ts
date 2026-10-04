/** DTOs passed from the server to the UI. Plain, serializable, no ObjectIds. */

export type TabStatus = "active" | "archived";

export type TabSummary = {
  id: string;
  name: string;
  description: string | null;
  status: TabStatus;
  participantCount: number;
  transactionCount: number;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
};

export type PersonSummary = {
  id: string;
  displayName: string;
  /** Transactions this person appears in (as payer or recipient). */
  transactionCount: number;
};

export type TabDetail = {
  tab: TabSummary;
  people: PersonSummary[];
};
