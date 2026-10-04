/** Suggested name for a new tab: the current month in Manila, e.g. "October 2026". */
export function defaultTabName(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(now);
}
