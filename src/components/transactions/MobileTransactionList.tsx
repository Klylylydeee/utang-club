"use client";

import { useState, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui/styles";
import { formatPhp } from "@/lib/settlement/money";
import type { TransactionRow } from "@/lib/transactions/types";
import { toRowValues } from "./rowValues";
import { TransactionSheet, type SheetTarget } from "./TransactionSheet";
import type { PersonOption } from "./TransactionRowView";

/**
 * Phone layout for the Transactions section (below `md`). A tappable list
 * instead of a sideways-scrolling table; each row opens a bottom sheet.
 */
export function MobileTransactionList(props: {
  tabId: string;
  people: PersonOption[];
  rows: TransactionRow[];
  actions?: ReactNode;
}) {
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const names = new Map(props.people.map((person) => [person.id, person.displayName]));

  return (
    <div className="space-y-3">
      <div className="flex gap-2 [&>*]:flex-1">
        <button type="button" onClick={() => setTarget({ mode: "create" })} className={buttonStyles.primary}>
          <span aria-hidden="true">+</span> Add transaction
        </button>
        {props.actions}
      </div>

      {props.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-separator px-4 py-8 text-center text-ink-secondary">
          No transactions yet. Add the first one above.
        </p>
      ) : (
        <ul
          aria-label="Transactions"
          className="divide-y divide-separator overflow-hidden rounded-2xl border border-separator bg-raised shadow-raised"
        >
          {props.rows.map((row) => {
            const payer = names.get(row.payerId) ?? "Unknown";
            const recipient = names.get(row.recipientId) ?? "Unknown";
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setTarget({ mode: "edit", id: row.id, values: toRowValues(row) })}
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-accent-soft"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.description}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-secondary">
                      {row.type === "payment" && (
                        <span className="rounded-md border border-separator px-1.5 text-xs font-medium text-ink">
                          Payment
                        </span>
                      )}
                      <span className="truncate">
                        {payer} {row.type === "payment" ? "paid" : "owes"} {recipient}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatPhp(row.amountPhpCentavos)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <TransactionSheet tabId={props.tabId} people={props.people} target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
