import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { MobileTransactionList } from "@/components/transactions/MobileTransactionList";
import { SplitBillButton } from "@/components/transactions/SplitBillButton";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { buttonStyles, cardStyles } from "@/components/ui/styles";
import { compareByName } from "@/lib/settlement/orderSettlements";
import { loadTabOr404 } from "@/lib/tabs/loadTab";
import { listTransactions } from "@/lib/transactions/transactionService";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({ params }: PageProps<"/tabs/[tabId]/transactions">) {
  const { tab, people, actor, canEdit } = await loadTabOr404((await params).tabId);
  const rows = await listTransactions(tab.id, actor);
  const options = people.map((person) => ({ id: person.id, displayName: person.displayName })).sort(compareByName);

  if (!canEdit) {
    return rows.length > 0 ? (
      <TransactionList rows={rows} people={options} />
    ) : (
      <EmptyState title="No transactions" body="Nothing was recorded in this tab." />
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

  const split = <SplitBillButton tabId={tab.id} people={options} />;
  // Phones get a list with a bottom-sheet editor; the spreadsheet starts at md.
  return (
    <>
      <div className="hidden md:block">
        <TransactionTable tabId={tab.id} people={options} rows={rows} actions={split} />
      </div>
      <div className="md:hidden">
        <MobileTransactionList tabId={tab.id} people={options} rows={rows} actions={split} />
      </div>
    </>
  );
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
