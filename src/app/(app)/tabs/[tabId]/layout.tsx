import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ArchiveToggle } from "@/components/tabs/ArchiveToggle";
import { SectionNav } from "@/components/tabs/SectionNav";
import { StatusBadge, tabCounts } from "@/components/tabs/TabCard";
import { loadTabOr404 } from "@/lib/tabs/loadTab";

export async function generateMetadata({ params }: LayoutProps<"/tabs/[tabId]">): Promise<Metadata> {
  const { tab } = await loadTabOr404((await params).tabId);
  return { title: tab.name };
}

export default async function TabLayout({ children, params }: LayoutProps<"/tabs/[tabId]">) {
  const { tab, access, ownerName, ownerId } = await loadTabOr404((await params).tabId);
  const isArchived = tab.status === "archived";
  const adminView = access === "admin";

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          bordered={false}
          breadcrumb={
            adminView
              ? [
                  { href: "/admin", label: "Admin" },
                  ...(ownerId ? [{ href: `/admin/users/${ownerId}`, label: ownerName ?? "Owner" }] : []),
                ]
              : [{ href: "/", label: "Tabs" }]
          }
          title={tab.name}
          badge={isArchived && <StatusBadge label="Archived" />}
          description={
            <>
              {tab.description && <p className="text-ink">{tab.description}</p>}
              <p>{tabCounts(tab)}</p>
            </>
          }
        />
        <SectionNav tabId={tab.id} />
      </div>

      {adminView && (
        <div role="status" className="rounded-[10px] border border-accent/30 bg-accent-soft px-4 py-3 text-[15px]">
          <span className="font-medium">You’re viewing {ownerName ?? "another user"}’s tab as an administrator.</span>{" "}
          <span className="text-ink-secondary">It’s read-only. Only its owner can make changes.</span>
        </div>
      )}

      {isArchived && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-[10px] border border-separator bg-raised p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-medium">This tab is archived.</span>{" "}
            <span className="text-ink-secondary">
              {adminView ? "Its owner can unarchive it." : "Unarchive it to add or change anything."}
            </span>
          </p>
          {!adminView && <ArchiveToggle tabId={tab.id} archived />}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
}
