import { formatPhp } from "@/lib/settlement/money";
import type { PersonTotalView } from "@/lib/settlements/types";
import { describeNet } from "@/lib/settlements/summaryText";

/**
 * Each person across all their pairs. Only sums of the cards above: no
 * debt is moved between people, so every figure traces back to a card.
 */
export function PersonTotalsList({ people }: { people: PersonTotalView[] }) {
  return (
    <ul className="divide-y divide-separator rounded-2xl border border-separator bg-raised shadow-raised">
      {people.map((total) => {
        const square = total.netCentavos === 0;
        const getsBack = total.netCentavos > 0;
        return (
          <li key={total.person.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5">
            <div className="min-w-0">
              <p className="font-medium break-words">{total.person.displayName}</p>
              {!square && (
                <p className="text-sm text-ink-secondary tabular-nums">
                  Owes {formatPhp(total.owesCentavos)} · Is owed {formatPhp(total.owedCentavos)}
                </p>
              )}
            </div>
            <p className={`text-right tabular-nums ${square ? "text-ink-secondary" : "font-semibold"} ${getsBack ? "text-positive" : ""}`}>
              <span aria-hidden="true">{square ? "✓ " : getsBack ? "↓ " : "↑ "}</span>
              {square ? "Square" : capitalize(describeNet(total.netCentavos))}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
