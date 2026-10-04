import type { Metadata } from "next";
import { cardStyles } from "@/components/ui/styles";
import { loadTabOr404 } from "@/lib/tabs/loadTab";

export const metadata: Metadata = { title: "Settlements" };

// Placeholder until settlement cards land (PHASING.md → Phase 6).
export default async function SettlementsPage({ params }: PageProps<"/tabs/[tabId]/settlements">) {
  await loadTabOr404((await params).tabId);
  return (
    <section className={`${cardStyles} px-6 py-12 text-center`} aria-labelledby="settlements-empty">
      <h2 id="settlements-empty" className="text-lg font-semibold">
        Nothing to settle yet
      </h2>
      <p className="mt-1 text-ink-secondary">Settlement cards appear here once transactions are recorded.</p>
    </section>
  );
}
