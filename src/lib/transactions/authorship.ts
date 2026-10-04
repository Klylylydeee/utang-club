/**
 * Who added and who last changed a transaction, as people read it. Pure and
 * client-safe: the server resolves accounts to names; this only words them.
 */

/** An account as a transaction's author: a name, never an id or email. */
export type AuthorRef = { name: string; isYou: boolean };

export type Authorship = {
  addedBy: AuthorRef | null;
  /** Set only when someone changed a field after the row was added. */
  editedBy: AuthorRef | null;
};

/**
 * "Added by Bea", "Added by you, edited by Dave", "Edited by you" (a row
 * from before authors were recorded), or null when nothing is known.
 */
export function describeAuthorship({ addedBy, editedBy }: Authorship): string | null {
  const added = addedBy ? `Added by ${who(addedBy)}` : null;
  if (!editedBy) return added;
  return added ? `${added}, edited by ${who(editedBy)}` : `Edited by ${who(editedBy)}`;
}

function who(author: AuthorRef): string {
  return author.isYou ? "you" : author.name;
}

/**
 * Names are worth showing once more than one account is involved: the tab
 * is shared, someone other than its owner is looking, or another account
 * wrote a row. A tab only you use stays uncluttered.
 */
export function shouldShowAuthorship(
  tab: { access: "owner" | "editor" | "viewer" | "admin"; isShared: boolean },
  rows: readonly Authorship[],
): boolean {
  if (tab.access !== "owner" || tab.isShared) return true;
  return rows.some((row) => (row.addedBy && !row.addedBy.isYou) || (row.editedBy && !row.editedBy.isYou));
}
