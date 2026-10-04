import { formatPhp } from "@/lib/settlement/money";

/**
 * A peso amount where the number leads: tabular figures, with the ₱ sign
 * set smaller and quieter. Formatting only (formatPhp); no arithmetic.
 * The parts are adjacent inline spans, so the text reads as one string
 * ("−₱100.00") for screen readers, copy and search.
 */
export function Money({ centavos, signed = false, className = "" }: { centavos: number; signed?: boolean; className?: string }) {
  const text = formatPhp(centavos);
  const digits = text.replace(/^−?₱/, "");
  const sign = text.startsWith("−") ? "−" : signed && centavos > 0 ? "+" : "";

  return (
    <span className={`tabular-nums whitespace-nowrap ${className}`}>
      {sign}
      <span className="mr-[0.08em] text-[0.72em] font-medium opacity-60">₱</span>
      {digits}
    </span>
  );
}
