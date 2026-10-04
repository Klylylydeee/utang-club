import { formatPhp } from "@/lib/settlement/money";
import type { SettlementSummary } from "./types";

/**
 * Plain text for pasting into a chat:
 *
 *   October 2026 · Utang Club
 *
 *   Adrian → Klyde: ₱23.03
 *   Simon → Adrian: ₱2,180.50
 *
 *   Per person
 *   Adrian: gets back ₱2,157.47
 *   ...
 */
export function buildSummaryText(tabName: string, summary: SettlementSummary): string {
  const lines = [`${tabName} · Utang Club`, ""];

  if (summary.outstanding.length === 0) {
    lines.push("Everyone is square. Nothing is outstanding.");
    return lines.join("\n");
  }

  for (const card of summary.outstanding) {
    lines.push(`${card.debtor.displayName} → ${card.creditor.displayName}: ${formatPhp(card.amountPhpCentavos)}`);
  }

  lines.push("", "Per person");
  for (const total of summary.people) {
    lines.push(`${total.person.displayName}: ${describeNet(total.netCentavos)}`);
  }
  return lines.join("\n");
}

/** "pays ₱23.03", "gets back ₱2,157.47", "square". Uses only the sign; no arithmetic. */
export function describeNet(netCentavos: number): string {
  if (netCentavos === 0) return "square";
  return netCentavos > 0 ? `gets back ${formatPhp(netCentavos)}` : `pays ${formatPhp(-netCentavos)}`;
}
