import Link from "next/link";
import { TabCard } from "@/components/tabs/TabCard";
import { buttonStyles, cardStyles } from "@/components/ui/styles";
import { listTabs } from "@/lib/tabs/tabService";

export default async function TabsPage() {
  const tabs = await listTabs();
  const active = tabs.filter((tab) => tab.status === "active");
  const archived = tabs.filter((tab) => tab.status === "archived");

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your tabs</h1>
          <p className="max-w-prose text-[17px] text-ink-secondary">
            One tab per month, or whenever you want a fresh start. Settle each one when it&apos;s done.
          </p>
        </div>
        <Link href="/tabs/new" className={`${buttonStyles.primary} self-start sm:self-auto`}>
          <span aria-hidden="true">＋</span> New tab
        </Link>
      </section>

      {active.length === 0 ? (
        <section className={`${cardStyles} px-6 py-12 text-center`} aria-labelledby="no-tabs">
          <h2 id="no-tabs" className="text-lg font-semibold">
            No open tabs
          </h2>
          <p className="mt-1 text-ink-secondary">Start a tab for this month to begin tracking.</p>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Open tabs">
          {active.map((tab) => (
            <li key={tab.id}>
              <TabCard tab={tab} />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg font-medium text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Archived ({archived.length})
          </summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Archived tabs">
            {archived.map((tab) => (
              <li key={tab.id}>
                <TabCard tab={tab} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
