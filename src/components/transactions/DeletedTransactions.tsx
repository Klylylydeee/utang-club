import { Money } from "@/components/ui/Money";
import { formatShortDateTime } from "@/lib/dates";
import { describeAuthorship } from "@/lib/transactions/authorship";
import type { DeletedTransactionRow } from "@/lib/transactions/types";
import { pluralize } from "@/lib/text";
import { RestoreTransactionButton } from "./RestoreTransactionButton";
import type { PersonOption } from "./TransactionRowView";

/**
 * Deleted rows stay part of the tab's history: who deleted what, and when.
 * Folded away by default (native <details>, no JavaScript needed).
 * Owners and editors can restore; everyone who can see the tab can read it.
 */
export function DeletedTransactions(props: {
  rows: DeletedTransactionRow[];
  people: PersonOption[];
  canRestore: boolean;
  showAuthors: boolean;
}) {
  if (props.rows.length === 0) return null;
  const names = new Map(props.people.map((person) => [person.id, person.displayName]));

  return (
    <details className="group/deleted">
      <summary className="inline-flex min-h-11 list-none items-center gap-2 rounded-lg font-medium text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="transition-transform group-open/deleted:rotate-90">
          ›
        </span>
        Recently deleted ({pluralize(props.rows.length, "transaction")})
      </summary>
      <ul
        aria-label="Deleted transactions"
        className="mt-3 divide-y divide-separator rounded-[10px] border border-separator bg-raised"
      >
        {props.rows.map((row) => {
          const payer = names.get(row.payerId) ?? "Unknown";
          const recipient = names.get(row.recipientId) ?? "Unknown";
          const deletedBy = row.deletedBy ? (row.deletedBy.isYou ? "you" : row.deletedBy.name) : null;
          const authorship = props.showAuthors ? describeAuthorship(row) : null;
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{row.description}</p>
                <p className="text-sm text-ink-secondary">
                  {payer} {row.type === "payment" ? "paid" : "owed"} {recipient}{" "}
                  <Money centavos={row.amountPhpCentavos} />
                </p>
                <p className="text-[13px] text-ink-secondary">
                  {deletedBy ? `Deleted by ${deletedBy}` : "Deleted"} on {formatShortDateTime(new Date(row.deletedAt))}
                  {authorship && `. ${authorship}`}
                </p>
              </div>
              {props.canRestore && <RestoreTransactionButton transactionId={row.id} description={row.description} />}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
