import { Money } from "@/components/ui/Money";
import type { PersonTotalView } from "@/lib/settlements/types";

/**
 * Each person across all their pairs. Only sums of the cards above: no
 * debt is moved between people, so every figure traces back to a card.
 */
export function PersonTotalsList({ people }: { people: PersonTotalView[] }) {
  return (
    <ul className="divide-y divide-separator rounded-[10px] border border-separator bg-raised">
      {people.map((total) => {
        const square = total.netCentavos === 0;
        const getsBack = total.netCentavos > 0;
        return (
          <li key={total.person.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="font-medium break-words">{total.person.displayName}</p>
              {!square && (
                <p className="text-[13px] text-ink-secondary">
                  Owes <Money centavos={total.owesCentavos} />, is owed <Money centavos={total.owedCentavos} />
                </p>
              )}
            </div>
            {square ? (
              <p className="shrink-0 text-ink-secondary">Square</p>
            ) : (
              <p className={`shrink-0 text-right ${getsBack ? "text-positive" : ""}`}>
                <span className="block text-[13px] text-ink-secondary">{getsBack ? "Gets back" : "Pays"}</span>
                <Money
                  centavos={getsBack ? total.netCentavos : -total.netCentavos}
                  className="text-[20px] font-semibold tracking-tight"
                />
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
