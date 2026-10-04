import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveToggle } from "@/components/tabs/ArchiveToggle";
import { SectionNav } from "@/components/tabs/SectionNav";
import { StatusBadge } from "@/components/tabs/TabCard";
import { loadTabOr404 } from "@/lib/tabs/loadTab";
import { pluralize } from "@/lib/text";

export async function generateMetadata({ params }: LayoutProps<"/tabs/[tabId]">): Promise<Metadata> {
  const { tab } = await loadTabOr404((await params).tabId);
  return { title: tab.name };
}

export default async function TabLayout({ children, params }: LayoutProps<"/tabs/[tabId]">) {
  const { tab } = await loadTabOr404((await params).tabId);
  const isArchived = tab.status === "archived";

  return (
    <div className="space-y-6">
      <Link href="/" className="-mt-4 inline-flex min-h-11 items-center text-ink-secondary hover:text-ink">
        <span aria-hidden="true">‹&nbsp;</span>Your tabs
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">{tab.name}</h1>
          {isArchived && <StatusBadge label="Archived" />}
        </div>
        {tab.description && <p className="max-w-prose text-ink-secondary">{tab.description}</p>}
        <p className="text-sm text-ink-secondary">
          {pluralize(tab.participantCount, "person", "people")} · {pluralize(tab.transactionCount, "transaction")}
        </p>
      </header>

      {isArchived && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-separator bg-raised p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-medium">Archived — read-only.</span>{" "}
            <span className="text-ink-secondary">Unarchive to add or change anything.</span>
          </p>
          <ArchiveToggle tabId={tab.id} archived />
        </div>
      )}

      <SectionNav tabId={tab.id} />

      <div>{children}</div>
    </div>
  );
}
