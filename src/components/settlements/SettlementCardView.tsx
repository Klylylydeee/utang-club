import { minorUnitsFor } from "@/lib/currency";
import { formatForeign, formatPhp } from "@/lib/settlement/money";
import type { SettlementCard, SettlementLine } from "@/lib/settlements/types";
import { pluralize } from "@/lib/text";

/**
 * One pair: who owes whom, and how much. Expands (native <details>, so it
 * works by touch and keyboard without JavaScript) to the rows behind it.
 */
export function SettlementCardView({ card }: { card: SettlementCard }) {
  const settled = card.status === "settled";
  const { debtor, creditor } = card;

  return (
    <details className="group/card rounded-2xl border border-separator bg-raised shadow-raised">
      <summary className="flex min-h-11 list-none flex-col gap-3 rounded-2xl p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-[17px] font-semibold break-words">
            {settled ? (
              <>
                {debtor.displayName} <span className="font-normal text-ink-secondary">&amp;</span> {creditor.displayName}
              </>
            ) : (
              <>
                {debtor.displayName}{" "}
                <span aria-hidden="true" className="text-ink-secondary">
                  →
                </span>
                <span className="sr-only">owes</span> {creditor.displayName}
              </>
            )}
          </h3>
          <span
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ink-secondary transition-transform group-open/card:rotate-180"
          >
            ▾
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          {settled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-positive">
              <span aria-hidden="true">✓</span> Settled
            </span>
          ) : (
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatPhp(card.amountPhpCentavos)}</p>
          )}
          <p className="text-sm text-ink-secondary">
            {pluralize(card.lines.length, "transaction")}
            <span className="sr-only">. Show details.</span>
          </p>
        </div>
      </summary>

      <div className="border-t border-separator px-5 pt-2 pb-5">
        <ul aria-label={`Transactions between ${debtor.displayName} and ${creditor.displayName}`}>
          {card.lines.map((line) => (
            <LineItem key={line.transactionId} line={line} card={card} />
          ))}
        </ul>

        <dl className="mt-3 space-y-1.5 border-t border-separator pt-3 text-sm">
          {card.reducedCentavos > 0 && (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-secondary">Owed</dt>
                <dd className="tabular-nums">{formatPhp(card.owedCentavos)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-secondary">Offsets and payments</dt>
                <dd className="tabular-nums">−{formatPhp(card.reducedCentavos)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-3 text-base font-semibold">
            <dt>{settled ? "Balance" : "Outstanding"}</dt>
            <dd className="tabular-nums">{formatPhp(card.amountPhpCentavos)}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

/** Label and sign come from type + direction; shown with text, not colour alone. */
function describe(line: SettlementLine, card: SettlementCard) {
  const forward = line.direction === "debtor-to-creditor";
  const from = forward ? card.debtor.displayName : card.creditor.displayName;
  const to = forward ? card.creditor.displayName : card.debtor.displayName;
  if (line.type === "payment") {
    return { badge: forward ? "Payment" : "Paid back", detail: `${from} paid ${to}` };
  }
  return { badge: forward ? null : "Offset", detail: `${from} owes ${to}` };
}

function LineItem({ line, card }: { line: SettlementLine; card: SettlementCard }) {
  const { badge, detail } = describe(line, card);
  const reduces = line.effectCentavos < 0;

  return (
    <li className="flex items-start justify-between gap-3 border-b border-separator py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="break-words">{line.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-secondary">
          {badge && (
            <span className="rounded-md border border-separator px-1.5 py-px text-xs font-medium text-ink">
              {line.type === "payment" ? <span aria-hidden="true">↩ </span> : <span aria-hidden="true">⇄ </span>}
              {badge}
            </span>
          )}
          <span>{detail}</span>
          {line.foreignCurrency && line.foreignAmountMinor !== null && (
            <span className="tabular-nums">
              · {formatForeign(line.foreignAmountMinor, line.foreignCurrency, minorUnitsFor(line.foreignCurrency))}
            </span>
          )}
        </p>
      </div>
      <p className={`shrink-0 tabular-nums ${reduces ? "text-positive" : ""}`}>
        <span className="sr-only">{reduces ? "reduces the balance by" : "adds"} </span>
        <span aria-hidden="true">{reduces ? "" : "+"}</span>
        {formatPhp(line.effectCentavos)}
      </p>
    </li>
  );
}
