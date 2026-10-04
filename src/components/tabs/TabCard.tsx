import Link from "next/link";
import { cardStyles } from "@/components/ui/styles";
import type { TabSummary } from "@/lib/tabs/types";
import { pluralize } from "@/lib/text";

export function TabCard({ tab }: { tab: TabSummary }) {
  return (
    <Link
      href={`/tabs/${tab.id}`}
      className={`${cardStyles} flex min-h-11 flex-col gap-1 p-5 transition-[transform,box-shadow] hover:-translate-y-px active:scale-[0.99]`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="truncate text-lg font-semibold">{tab.name}</span>
        {tab.status === "archived" && <StatusBadge label="Archived" />}
      </span>
      {tab.description && <span className="line-clamp-2 text-ink-secondary">{tab.description}</span>}
      <span className="text-sm text-ink-secondary">
        {pluralize(tab.participantCount, "person", "people")} · {pluralize(tab.transactionCount, "transaction")}
      </span>
    </Link>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full border border-separator px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
      {label}
    </span>
  );
}
