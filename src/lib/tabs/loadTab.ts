import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { objectIdSchema } from "@/schemas/common";
import { getTabDetail } from "./tabService";
import type { TabDetail } from "./types";

/**
 * Loads a tab for a page or layout, once per request (React cache), and
 * renders the 404 page for malformed or unknown ids.
 */
export const loadTabOr404 = cache(async (tabId: string): Promise<TabDetail> => {
  const parsed = objectIdSchema.safeParse(tabId);
  if (!parsed.success) notFound();
  const detail = await getTabDetail(parsed.data);
  if (!detail) notFound();
  return detail;
});
