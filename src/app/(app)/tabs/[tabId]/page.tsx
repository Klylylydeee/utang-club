import { PeoplePanel } from "@/components/people/PeoplePanel";
import { ArchiveToggle } from "@/components/tabs/ArchiveToggle";
import { TabDetailsForm } from "@/components/tabs/TabDetailsForm";
import { cardStyles } from "@/components/ui/styles";
import { loadTabOr404 } from "@/lib/tabs/loadTab";

export default async function TabOverviewPage({ params }: PageProps<"/tabs/[tabId]">) {
  const { tab, people, canEdit } = await loadTabOr404((await params).tabId);
  const readOnly = !canEdit;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-labelledby="people-heading" className={`${cardStyles} p-5 sm:p-6`}>
        <h2 id="people-heading" className="text-lg font-semibold">
          People
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">Everyone who was there. They don’t need an account.</p>
        <div className="mt-5">
          <PeoplePanel tabId={tab.id} people={people} readOnly={readOnly} />
        </div>
      </section>

      {!readOnly && (
        <section aria-labelledby="settings-heading" className={`${cardStyles} space-y-6 self-start p-5 sm:p-6`}>
          <h2 id="settings-heading" className="text-lg font-semibold">
            Tab details
          </h2>
          <TabDetailsForm tabId={tab.id} name={tab.name} description={tab.description ?? ""} />
          <div className="border-t border-separator pt-5">
            <p className="mb-3 text-sm text-ink-secondary">
              All settled? Archive the tab to keep its history and prevent accidental edits.
            </p>
            <ArchiveToggle tabId={tab.id} archived={false} />
          </div>
        </section>
      )}
    </div>
  );
}
