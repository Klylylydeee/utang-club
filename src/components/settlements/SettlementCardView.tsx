import { Money } from "@/components/ui/Money";
import { minorUnitsFor } from "@/lib/currency";
import { formatForeign } from "@/lib/settlement/money";
import type { SettlementCard, SettlementLine } from "@/lib/settlements/types";
import { describeAuthorship } from "@/lib/transactions/authorship";
import { pluralize } from "@/lib/text";
import { RecordPaymentButton } from "./RecordPaymentButton";

/**
 * One pair, read as a sentence: "Bea → Dave, ₱642.75". The amount is the
 * loudest thing on the page. Expands (native <details>: touch and keyboard
 * without JavaScript) to the rows behind it. Outstanding cards sit raised;
 * settled ones lie flat so the open debts stand out.
 */
export function SettlementCardView({
  card,
  tabId,
  readOnly,
  showAuthors = false,
}: {
  card: SettlementCard;
  tabId: string;
  readOnly: boolean;
  /** Show who added and changed each line (tabs more than one account uses). */
  showAuthors?: boolean;
}) {
  const settled = card.status === "settled";
  const { debtor, creditor } = card;

  return (
    <article
      className={`rounded-[10px] border border-separator ${settled ? "bg-transparent" : "bg-raised shadow-raised"}`}
    >
      <details className="group/card">
        <summary className="list-none rounded-[10px] px-5 pt-5 pb-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex min-w-0 flex-wrap items-center gap-x-2.5 text-[17px] font-semibold">
              <span className="break-words">{debtor.displayName}</span>
              {settled ? (
                <span className="font-normal text-ink-secondary">and</span>
              ) : (
                <>
                  <Arrow />
                  <span className="sr-only">owes</span>
                </>
              )}
              <span className="break-words">{creditor.displayName}</span>
            </h3>
            <Chevron />
          </div>

          {settled ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-3 py-1 text-[15px] font-medium text-positive">
              <span aria-hidden="true">✓</span> Settled
            </p>
          ) : (
            <Money
              centavos={card.amountPhpCentavos}
              className="mt-2 block text-[34px] leading-tight font-semibold tracking-tight"
            />
          )}

          <p className="mt-1.5 text-[13px] text-ink-secondary">
            {pluralize(card.lines.length, "transaction")}
            <span className="sr-only group-open/card:hidden">. Show details</span>
          </p>
        </summary>

        <div className="mx-5 border-t border-separator pb-4">
          <ul aria-label={`Transactions between ${debtor.displayName} and ${creditor.displayName}`}>
            {card.lines.map((line) => (
              <LineItem key={line.transactionId} line={line} card={card} showAuthors={showAuthors} />
            ))}
          </ul>

          <dl className="space-y-1 border-t border-separator pt-3 text-[15px]">
            {card.reducedCentavos > 0 && (
              <>
                <div className="flex justify-between gap-3 text-ink-secondary">
                  <dt>Owed</dt>
                  <dd>
                    <Money centavos={card.owedCentavos} />
                  </dd>
                </div>
                <div className="flex justify-between gap-3 text-ink-secondary">
                  <dt>Offsets and payments</dt>
                  <dd>
                    <Money centavos={-card.reducedCentavos} />
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-3 font-semibold">
              <dt>{settled ? "Balance" : "Outstanding"}</dt>
              <dd>
                <Money centavos={card.amountPhpCentavos} />
              </dd>
            </div>
          </dl>
        </div>
      </details>

      {!settled && !readOnly && (
        <div className="px-3 pb-3">
          <RecordPaymentButton
            tabId={tabId}
            debtor={debtor}
            creditor={creditor}
            outstandingCentavos={card.amountPhpCentavos}
          />
        </div>
      )}
    </article>
  );
}

/** Label and sign come from type + direction; always words, never colour alone. */
function describe(line: SettlementLine, card: SettlementCard) {
  const forward = line.direction === "debtor-to-creditor";
  const from = forward ? card.debtor.displayName : card.creditor.displayName;
  const to = forward ? card.creditor.displayName : card.debtor.displayName;
  if (line.type === "payment") {
    return { tag: forward ? "Payment" : "Paid back", detail: `${from} paid ${to}` };
  }
  return { tag: forward ? null : "Offset", detail: `${from} owes ${to}` };
}

function LineItem({ line, card, showAuthors }: { line: SettlementLine; card: SettlementCard; showAuthors: boolean }) {
  const { tag, detail } = describe(line, card);
  const byline = showAuthors ? describeAuthorship(line) : null;
  const reduces = line.effectCentavos < 0;

  return (
    <li className="flex items-start justify-between gap-3 border-b border-separator py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="break-words">{line.description}</p>
        <p className="mt-0.5 text-[13px] text-ink-secondary">
          {tag && <span className="font-medium text-ink">{tag}: </span>}
          {detail}
          {line.foreignCurrency && line.foreignAmountMinor !== null && (
            <>
              {", "}
              <span className="tabular-nums">
                {formatForeign(line.foreignAmountMinor, line.foreignCurrency, minorUnitsFor(line.foreignCurrency))}
              </span>
            </>
          )}
        </p>
        {byline && <p className="mt-0.5 text-[13px] text-ink-secondary">{byline}</p>}
      </div>
      <p className={`shrink-0 ${reduces ? "text-positive" : ""}`}>
        <span className="sr-only">{reduces ? "Reduces the balance:" : "Adds:"} </span>
        <Money centavos={line.effectCentavos} signed />
      </p>
    </li>
  );
}

/** A long, thin arrow: the direction of the debt, drawn rather than typed. */
function Arrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 12"
      className="h-3 w-7 shrink-0 text-ink-secondary"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 6h25M21 1.5 26 6l-5 4.5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mt-1 size-4 shrink-0 text-ink-secondary transition-transform duration-200 group-open/card:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
