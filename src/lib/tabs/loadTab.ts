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
  /** Owner of an active tab. Admins viewing someone else's tab, and archived tabs, are read-only. */
  canEdit: boolean;
};

/**
 * Loads a tab for a page or layout, once per request (React cache), for the
 * signed-in user. Malformed ids, unknown tabs and tabs the user may not
 * see all render the same 404.
 */
export const loadTabOr404 = cache(async (tabId: string): Promise<LoadedTab> => {
  const parsed = objectIdSchema.safeParse(tabId);
  if (!parsed.success) notFound();
  const { user } = await requireSession();
  const actor = actorFrom(user);
  const detail = await getTabDetail(parsed.data, actor);
  if (!detail) notFound();
  return { ...detail, actor, canEdit: detail.access === "owner" && detail.tab.status === "active" };
});
