import { minorUnitsFor } from "@/lib/currency";
import { formatForeign, formatPhp } from "@/lib/settlement/money";
import type { TransactionRow } from "@/lib/transactions/types";
import type { PersonOption } from "./TransactionRowView";

/** Read-only rows for an archived tab (D6). Server-rendered; no inputs. */
export function TransactionList({ rows, people }: { rows: TransactionRow[]; people: PersonOption[] }) {
  const names = new Map(people.map((person) => [person.id, person.displayName]));
  const showForeign = rows.some((row) => row.foreignCurrency !== null);

  return (
    <div className="relative overflow-x-auto overscroll-x-contain rounded-[10px] border border-separator bg-raised shadow-raised">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Transactions (read-only)</caption>
        <thead>
          <tr className="border-b border-separator text-sm text-ink-secondary">
            <th scope="col" className="px-4 py-3 font-medium">Description</th>
            {showForeign && <th scope="col" className="px-4 py-3 text-right font-medium">Foreign amount</th>}
            <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
            <th scope="col" className="px-4 py-3 font-medium">To pay</th>
            <th scope="col" className="px-4 py-3 font-medium">To be paid</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-separator last:border-b-0">
              <td className="px-4 py-3 break-words">{row.description}</td>
              {showForeign && (
                <td className="px-4 py-3 text-right text-ink-secondary tabular-nums">
                  {row.foreignCurrency && row.foreignAmountMinor !== null
                    ? formatForeign(row.foreignAmountMinor, row.foreignCurrency, minorUnitsFor(row.foreignCurrency))
                    : ""}
                </td>
              )}
              <td className="px-4 py-3 text-right font-medium tabular-nums">{formatPhp(row.amountPhpCentavos)}</td>
              <td className="px-4 py-3">{names.get(row.payerId) ?? "Unknown"}</td>
              <td className="px-4 py-3">{names.get(row.recipientId) ?? "Unknown"}</td>
              <td className="px-4 py-3 text-ink-secondary">{row.type === "payment" ? "Payment" : "Expense"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
