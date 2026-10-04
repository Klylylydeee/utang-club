import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { actorFrom, type Actor } from "@/lib/auth/actor";
import { requireSession } from "@/lib/auth/session";
import { objectIdSchema } from "@/schemas/common";
import { getTabDetail } from "./tabService";
import type { TabDetail } from "./types";

export type LoadedTab = TabDetail & {
  actor: Actor;
  /**
   * May change what's inside: the owner or an editor (D19), on an active
   * tab. Viewers, admins viewing someone else's tab, and archived tabs are
   * read-only.
   */
  canEdit: boolean;
  /** Renames, archives and shares the tab: the owner only. */
  isOwner: boolean;
};

/**
 * Loads a tab for the signed-in user, once per request (React cache), or
 * null for a malformed id, an unknown tab, or a tab the user may not see.
 * For metadata, which must not throw notFound() (the 404 page then has no title).
 */
export const findTab = cache(async (tabId: string): Promise<LoadedTab | null> => {
  const parsed = objectIdSchema.safeParse(tabId);
  if (!parsed.success) return null;
  const { user } = await requireSession();
  const actor = actorFrom(user);
  const detail = await getTabDetail(parsed.data, actor);
  if (!detail) return null;
  const writer = detail.access === "owner" || detail.access === "editor";
  return { ...detail, actor, canEdit: writer && detail.tab.status === "active", isOwner: detail.access === "owner" };
});

/** For pages and layouts: every "no" in findTab renders the same 404. */
export async function loadTabOr404(tabId: string): Promise<LoadedTab> {
  return (await findTab(tabId)) ?? notFound();
}
