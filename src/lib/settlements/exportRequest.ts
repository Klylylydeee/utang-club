import "server-only";
import { DomainError } from "@/lib/actions/result";
import { actorFrom } from "@/lib/auth/actor";
import { getSession } from "@/lib/auth/session";
import { objectIdSchema } from "@/schemas/common";
import { getSettlementExport, type SettlementExport } from "./settlementService";

/**
 * Route handlers don't run the (app) layout, so each export route checks the
 * session itself. A malformed id, no session, or a tab this user may not see
 * all come back as null: the route answers 404 for every one of them.
 */
export async function loadExportForRequest(rawTabId: string): Promise<SettlementExport | null> {
  const tabId = objectIdSchema.safeParse(rawTabId);
  if (!tabId.success) return null;
  const session = await getSession();
  if (!session) return null;
  try {
    return await getSettlementExport(tabId.data, actorFrom(session.user));
  } catch (error) {
    if (error instanceof DomainError && error.code === "not-found") return null;
    throw error;
  }
}

/** Exports are personal data: never cached by the browser or a proxy. */
export const EXPORT_CACHE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export function exportNotFound(): Response {
  return new Response("Not found", { status: 404, headers: { ...EXPORT_CACHE_HEADERS, "Content-Type": "text/plain" } });
}
