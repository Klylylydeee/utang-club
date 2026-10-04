import { EXPORT_CACHE_HEADERS, exportNotFound, loadExportForRequest } from "@/lib/settlements/exportRequest";
import { buildSettlementCsv } from "@/lib/settlements/settlementCsv";
import { exportFileName } from "@/lib/settlements/shareModel";

/** Every transaction plus each pair's balance, for spreadsheets. Read-only. */
export async function GET(_request: Request, { params }: RouteContext<"/tabs/[tabId]/settlements/csv">) {
  const data = await loadExportForRequest((await params).tabId);
  if (!data) return exportNotFound();

  // The byte-order mark makes Excel read ₱ and names as UTF-8.
  const body = `﻿${buildSettlementCsv(data.rows, data.people, data.summary)}`;
  return new Response(body, {
    headers: {
      ...EXPORT_CACHE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(data.tabName, "csv", new Date())}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
