import type { Metadata } from "next";
import Link from "next/link";
import { CopySummaryButton } from "@/components/settlements/CopySummaryButton";
import { PersonTotalsList } from "@/components/settlements/PersonTotalsList";
import { SettlementCardView } from "@/components/settlements/SettlementCardView";
import { buttonStyles, cardStyles } from "@/components/ui/styles";
import { getSettlements } from "@/lib/settlements/settlementService";
import { buildSummaryText } from "@/lib/settlements/summaryText";
import { loadTabOr404 } from "@/lib/tabs/loadTab";
import { pluralize } from "@/lib/text";

export const metadata: Metadata = { title: "Settlements" };

export default async function SettlementsPage({ params }: PageProps<"/tabs/[tabId]/settlements">) {
  const { tab, actor, canEdit } = await loadTabOr404((await params).tabId);
  const summary = await getSettlements(tab.id, actor);
  const { outstanding, settled, people } = summary;
  const readOnly = !canEdit;

  if (outstanding.length === 0 && settled.length === 0) {
    return (
      <section className={`${cardStyles} space-y-4 px-6 py-12 text-center`} aria-labelledby="settlements-empty">
        <div>
          <h2 id="settlements-empty" className="text-lg font-semibold">
            Nothing to settle yet
          </h2>
          <p className="mx-auto mt-1 max-w-prose text-ink-secondary">
            Add transactions and each pair’s balance appears here, netted both ways.
          </p>
        </div>
        <Link href={`/tabs/${tab.id}/transactions`} className={buttonStyles.primary}>
          Go to transactions
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="outstanding-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="outstanding-heading" className="text-lg font-semibold">
              Who pays whom
            </h2>
            <p className="text-sm text-ink-secondary">Tap a card to see the transactions behind it.</p>
          </div>
          <CopySummaryButton text={buildSummaryText(tab.name, summary)} />
        </div>
        {outstanding.length === 0 ? (
          <p className={`${cardStyles} px-5 py-8 text-center text-ink-secondary`}>
            <span aria-hidden="true">✓ </span>Everyone is square. Nothing is outstanding.
          </p>
        ) : (
          <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {outstanding.map((card) => (
              <li key={card.key}>
                <SettlementCardView card={card} tabId={tab.id} readOnly={readOnly} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {outstanding.length > 0 && (
        <section aria-labelledby="people-totals-heading" className="space-y-4">
          <div>
            <h2 id="people-totals-heading" className="text-lg font-semibold">
              By person
            </h2>
            <p className="text-sm text-ink-secondary">
              Each person’s pairs added up. Payments still go pair by pair.
            </p>
          </div>
          <PersonTotalsList people={people} />
        </section>
      )}

      {settled.length > 0 && (
        <details className="group/settled">
          <summary className="inline-flex min-h-11 list-none items-center gap-2 rounded-lg font-medium text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="transition-transform group-open/settled:rotate-90">
              ›
            </span>
            Settled ({pluralize(settled.length, "pair")})
          </summary>
          <ul className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {settled.map((card) => (
              <li key={card.key}>
                <SettlementCardView card={card} tabId={tab.id} readOnly={readOnly} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
