import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ArchiveToggle } from "@/components/tabs/ArchiveToggle";
import { LeaveTabButton } from "@/components/tabs/LeaveTabButton";
import { SectionNav } from "@/components/tabs/SectionNav";
import { StatusBadge, tabCounts } from "@/components/tabs/TabCard";
import { findTab, loadTabOr404 } from "@/lib/tabs/loadTab";

export async function generateMetadata({ params }: LayoutProps<"/tabs/[tabId]">): Promise<Metadata> {
  const found = await findTab((await params).tabId);
  return { title: found ? found.tab.name : "Not found" };
}

export default async function TabLayout({ children, params }: LayoutProps<"/tabs/[tabId]">) {
  const { tab, access, ownerName, ownerId } = await loadTabOr404((await params).tabId);
  const isArchived = tab.status === "archived";
  const adminView = access === "admin";
  const shared = access === "viewer" || access === "editor";

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

      {shared && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-[10px] border border-accent/30 bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-[15px]">
            <span className="font-medium">{ownerName ?? "Someone"} shared this tab with you.</span>{" "}
            <span className="text-ink-secondary">
              {access === "editor"
                ? "You can add and change people and transactions."
                : "You can view it, but not change it."}
            </span>
          </p>
          <LeaveTabButton tabId={tab.id} />
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
              {access === "owner" ? "Unarchive it to add or change anything." : "Its owner can unarchive it."}
            </span>
          </p>
          {access === "owner" && <ArchiveToggle tabId={tab.id} archived />}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
}
