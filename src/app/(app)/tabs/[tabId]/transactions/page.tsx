import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { buttonStyles, cardStyles } from "@/components/ui/styles";
import { loadTabOr404 } from "@/lib/tabs/loadTab";
import { listTransactions } from "@/lib/transactions/transactionService";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({ params }: PageProps<"/tabs/[tabId]/transactions">) {
  const { tab, people } = await loadTabOr404((await params).tabId);
  const rows = await listTransactions(tab.id);
  const options = people.map((person) => ({ id: person.id, displayName: person.displayName }));

  if (tab.status === "archived") {
    return rows.length > 0 ? (
      <TransactionList rows={rows} people={options} />
    ) : (
      <EmptyState title="No transactions" body="This tab was archived without any transactions." />
    );
  }

  if (people.length < 2) {
    return (
      <EmptyState
        title="Add people first"
        body="A transaction needs someone who owes and someone who is owed. Add at least two people to this tab."
        action={
          <Link href={`/tabs/${tab.id}`} className={buttonStyles.primary}>
            Add people
          </Link>
        }
      />
    );
  }

  return <TransactionTable tabId={tab.id} people={options} rows={rows} />;
}

function EmptyState(props: { title: string; body: string; action?: ReactNode }) {
  return (
    <section className={`${cardStyles} space-y-4 px-6 py-12 text-center`} aria-labelledby="transactions-empty">
      <div>
        <h2 id="transactions-empty" className="text-lg font-semibold">
          {props.title}
        </h2>
        <p className="mx-auto mt-1 max-w-prose text-ink-secondary">{props.body}</p>
      </div>
      {props.action}
    </section>
  );
}
