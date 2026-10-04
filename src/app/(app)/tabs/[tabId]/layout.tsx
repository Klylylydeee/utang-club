import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveToggle } from "@/components/tabs/ArchiveToggle";
import { SectionNav } from "@/components/tabs/SectionNav";
import { StatusBadge, tabCounts } from "@/components/tabs/TabCard";
import { loadTabOr404 } from "@/lib/tabs/loadTab";

export async function generateMetadata({ params }: LayoutProps<"/tabs/[tabId]">): Promise<Metadata> {
  const { tab } = await loadTabOr404((await params).tabId);
  return { title: tab.name };
}

export default async function TabLayout({ children, params }: LayoutProps<"/tabs/[tabId]">) {
  const { tab, access, ownerName } = await loadTabOr404((await params).tabId);
  const isArchived = tab.status === "archived";
  const adminView = access === "admin";

  return (
    <div className="space-y-6">
      <Link
        href={adminView ? "/admin" : "/"}
        className="-mt-4 inline-flex min-h-11 items-center text-ink-secondary hover:text-ink"
      >
        <span aria-hidden="true">‹&nbsp;</span>
        {adminView ? "All users" : "Your tabs"}
      </Link>

      {adminView && (
        <div role="status" className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-[15px]">
          <span className="font-medium">Viewing {ownerName ?? "another user"}’s tab as an administrator.</span>{" "}
          <span className="text-ink-secondary">It’s read-only; only its owner can change it.</span>
        </div>
      )}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">{tab.name}</h1>
          {isArchived && <StatusBadge label="Archived" />}
        </div>
        {tab.description && <p className="max-w-prose text-ink-secondary">{tab.description}</p>}
        <p className="text-sm text-ink-secondary">
          {tabCounts(tab)}
        </p>
      </header>

      {isArchived && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-separator bg-raised p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-medium">Archived — read-only.</span>{" "}
            <span className="text-ink-secondary">
              {adminView ? "Its owner can unarchive it." : "Unarchive to add or change anything."}
            </span>
          </p>
          {!adminView && <ArchiveToggle tabId={tab.id} archived />}
        </div>
      )}

      <SectionNav tabId={tab.id} />

      <div>{children}</div>
    </div>
  );
}
