/** The app's calendar is Manila time, whatever the server's time zone is. */
const TIME_ZONE = "Asia/Manila";

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
const isoDate = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE });

const shortDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

/** "4 Oct 2026, 3:15 pm" (Manila time). */
export function formatShortDateTime(date: Date): string {
  return shortDateTime.format(date);
}

/** "4 October 2026". */
export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

/** "2026-10-04", the Manila calendar day. */
export function formatIsoDate(date: Date): string {
  return isoDate.format(date);
}
