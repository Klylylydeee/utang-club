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

/** "owner": full access. "admin": an administrator viewing someone else's tab (read-only). */
export type TabAccess = "owner" | "admin";

export type TabDetail = {
  tab: TabSummary;
  people: PersonSummary[];
  access: TabAccess;
  /** The owner's name, shown to an admin viewing someone else's tab; null otherwise. */
  ownerName: string | null;
  /** The owner's user id when an admin views someone else's tab, for the breadcrumb; null otherwise. */
  ownerId: string | null;
};
