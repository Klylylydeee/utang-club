import type { Metadata } from "next";
import { cardStyles } from "@/components/ui/styles";
import { loadTabOr404 } from "@/lib/tabs/loadTab";

export const metadata: Metadata = { title: "Transactions" };

// Placeholder until the transaction table lands (PHASING.md → Phase 5).
export default async function TransactionsPage({ params }: PageProps<"/tabs/[tabId]/transactions">) {
  const { tab } = await loadTabOr404((await params).tabId);
  return (
    <section className={`${cardStyles} px-6 py-12 text-center`} aria-labelledby="transactions-empty">
      <h2 id="transactions-empty" className="text-lg font-semibold">
        No transactions yet
      </h2>
      <p className="mt-1 text-ink-secondary">
        {tab.transactionCount === 0
          ? "Transaction entry is coming next."
          : `${tab.transactionCount} recorded. The table view is coming next.`}
      </p>
    </section>
  );
}
