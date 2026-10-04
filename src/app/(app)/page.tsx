import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabList } from "@/components/tabs/TabCard";
import { buttonStyles, cardStyles } from "@/components/ui/styles";
import { actorFrom } from "@/lib/auth/actor";
import { requireSession } from "@/lib/auth/session";
import { listTabs } from "@/lib/tabs/tabService";

export default async function TabsPage() {
  const { user } = await requireSession();
  const tabs = await listTabs(actorFrom(user));
  const active = tabs.filter((tab) => tab.status === "active");
  const archived = tabs.filter((tab) => tab.status === "archived");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tabs"
        description="One tab for each trip, night out or dinner. Add who was there, record what was spent, and settle up when it’s over."
        actions={
          <Link href="/tabs/new" className={buttonStyles.primary}>
            New tab
          </Link>
        }
      />

      {active.length === 0 ? (
        <section className={`${cardStyles} px-6 py-12 text-center`} aria-labelledby="no-tabs">
          <h2 id="no-tabs" className="text-lg font-semibold">
            No open tabs
          </h2>
          <p className="mx-auto mt-1 max-w-[50ch] text-ink-secondary">
            Start one for your next trip, night out or dinner. You can add the people and expenses as you go.
          </p>
          <Link href="/tabs/new" className={`${buttonStyles.primary} mt-5`}>
            New tab
          </Link>
        </section>
      ) : (
        <section aria-labelledby="open-heading" className="space-y-3">
          <h2 id="open-heading" className="text-[15px] font-semibold text-ink-secondary">
            Open ({active.length})
          </h2>
          <TabList tabs={active} label="Open tabs" />
        </section>
      )}

      {archived.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-[15px] font-semibold text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Archived ({archived.length})
          </summary>
          <div className="mt-3">
            <TabList tabs={archived} label="Archived tabs" />
          </div>
        </details>
      )}
    </div>
  );
}
