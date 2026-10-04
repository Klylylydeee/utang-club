import Link from "next/link";
import type { TabSummary } from "@/lib/tabs/types";
import { pluralize } from "@/lib/text";

/** "4 people, 8 transactions" — the tab's size in plain words. */
export function tabCounts(tab: Pick<TabSummary, "participantCount" | "transactionCount">) {
  return `${pluralize(tab.participantCount, "person", "people")}, ${pluralize(tab.transactionCount, "transaction")}`;
}

/** A row in TabList. Shared tabs also say who shared them and with what access (D19). */
export type TabListItem = TabSummary & { sharedBy?: string; accessLabel?: string };

/** Tabs as one grouped list (rows with a chevron), not a grid of identical cards. */
export function TabList({ tabs, label }: { tabs: TabListItem[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-separator overflow-hidden rounded-[10px] border border-separator bg-raised">
      {tabs.map((tab) => (
        <li key={tab.id}>
          <Link
            href={`/tabs/${tab.id}`}
            className="flex min-h-16 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent-soft active:bg-accent-soft"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-semibold">{tab.name}</span>
              {tab.description && <span className="block truncate text-[15px] text-ink-secondary">{tab.description}</span>}
              <span className="block text-[13px] text-ink-secondary">
                {tabCounts(tab)}
                {tab.sharedBy && `. Shared by ${tab.sharedBy}`}
              </span>
            </span>
            {tab.accessLabel && <StatusBadge label={tab.accessLabel} />}
            {tab.status === "archived" && <StatusBadge label="Archived" />}
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4 shrink-0 text-ink-secondary"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full border border-separator px-2.5 py-0.5 text-[13px] font-medium text-ink-secondary">
      {label}
    </span>
  );
}
