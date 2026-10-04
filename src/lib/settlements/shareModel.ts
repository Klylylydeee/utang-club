import { formatIsoDate, formatLongDate } from "@/lib/dates";
import { formatPhp } from "@/lib/settlement/money";
import { pluralize } from "@/lib/text";
import type { SettlementSummary } from "./types";

/** More lines than this make an image unreadable in a chat. */
export const SHARE_LINE_LIMIT = 20;

export type SharePair = { key: string; from: string; to: string; amount: string };
export type ShareNet = { key: string; name: string; verb: "gets back" | "pays"; amount: string };

/** Everything the share image shows, already formatted: the renderer only lays it out. */
export type ShareModel = {
  tabName: string;
  /** "as of 4 October 2026" (Asia/Manila). */
  asOf: string;
  pairs: SharePair[];
  /** Outstanding pairs left out past the line limit. */
  morePairs: number;
  /** People who pay or get back; square people are left out. */
  nets: ShareNet[];
  morePeople: number;
  /** "2 settled pairs · Made with Utang Club". */
  footer: string;
};

/**
 * The shareable view of a tab's settlements: outstanding pairs and each
 * person's net, without line items or settled pairs (HANDOFF.md default,
 * still to be confirmed by the owner). Pure; formatting only.
 */
export function buildShareModel(tabName: string, summary: SettlementSummary, now: Date): ShareModel {
  const pairs = summary.outstanding.map((card) => ({
    key: card.key,
    from: card.debtor.displayName,
    to: card.creditor.displayName,
    amount: formatPhp(card.amountPhpCentavos),
  }));
  const nets: ShareNet[] = summary.people
    .filter((total) => total.netCentavos !== 0)
    .map((total) => ({
      key: total.person.id,
      name: total.person.displayName,
      verb: total.netCentavos > 0 ? "gets back" : "pays",
      amount: formatPhp(Math.abs(total.netCentavos)),
    }));

  const settled = summary.settled.length;
  return {
    tabName,
    asOf: `as of ${formatLongDate(now)}`,
    pairs: pairs.slice(0, SHARE_LINE_LIMIT),
    morePairs: Math.max(0, pairs.length - SHARE_LINE_LIMIT),
    nets: nets.slice(0, SHARE_LINE_LIMIT),
    morePeople: Math.max(0, nets.length - SHARE_LINE_LIMIT),
    footer: [settled > 0 ? pluralize(settled, "settled pair") : null, "Made with Utang Club"]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * A safe download name: "utang-club-japan-trip-2026-10-04.png". Only
 * ASCII letters, digits and dashes, so it needs no header escaping.
 */
export function exportFileName(tabName: string, extension: "png" | "csv", now: Date): string {
  const slug = tabName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return ["utang-club", slug, formatIsoDate(now)].filter(Boolean).join("-") + `.${extension}`;
}
