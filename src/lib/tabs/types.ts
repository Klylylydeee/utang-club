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

/**
 * How the actor may use a tab:
 *   "owner"  — everything, including renaming, archiving and sharing;
 *   "editor" — shared with edit access: may change what's inside (D19);
 *   "viewer" — shared with view access: read-only (D19);
 *   "admin"  — an administrator viewing someone else's tab: read-only.
 */
export type TabAccess = "owner" | "editor" | "viewer" | "admin";

/** A tab someone else shared with the actor, for the "Shared with you" list. */
export type SharedTabSummary = TabSummary & {
  ownerName: string;
  role: "viewer" | "editor";
};

/** Someone the owner shared a tab with, as the owner's Sharing panel shows them. */
export type TabShareView = {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "editor";
};

export type TabDetail = {
  tab: TabSummary;
  people: PersonSummary[];
  access: TabAccess;
  /** The owner's name for anyone but the owner (editor, viewer, admin); null for the owner. */
  ownerName: string | null;
  /** The owner's user id when an admin views someone else's tab, for the breadcrumb; null otherwise. */
  ownerId: string | null;
};
