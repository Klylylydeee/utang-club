/**
 * Shared control styles. Every interactive control is at least 44px tall
 * (min-h-11) per UI_SPEC.md → Touch interaction rules.
 */

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-[background-color,color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-accent-ink hover:bg-accent-hover`,
  secondary: `${buttonBase} border border-separator bg-raised text-ink hover:bg-accent-soft`,
  /** The action on a card: accent text on a soft accent wash. */
  tinted: `${buttonBase} bg-accent-soft text-accent hover:bg-accent hover:text-accent-ink`,
  quiet: `${buttonBase} text-ink-secondary hover:bg-accent-soft hover:text-ink`,
  danger: `${buttonBase} border border-separator bg-raised text-negative hover:bg-accent-soft`,
} as const;

export const inputStyles =
  "block min-h-11 w-full rounded-xl border border-separator bg-surface px-3.5 text-ink outline-none transition-colors placeholder:text-ink-secondary/70 focus:border-accent aria-[invalid=true]:border-negative";

/**
 * Spreadsheet cell controls: borderless until hovered or focused, still
 * 44px tall. The focus ring is drawn inside so the scrolling table can't
 * clip it.
 */
export const cellInputStyles =
  "block min-h-11 w-full rounded-lg border border-transparent bg-transparent px-2.5 text-ink outline-none transition-colors placeholder:text-ink-secondary/60 hover:border-separator focus:border-accent focus:bg-raised focus-visible:outline-offset-[-3px] read-only:text-ink-secondary aria-[invalid=true]:border-negative";

/** Square 44px icon button for row actions; always visible, never hover-only. */
export const iconButtonStyles =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-accent-soft hover:text-ink active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50";

/** Containers use a 20px radius; controls 12px (rounded-xl); chips are fully round. */
export const cardStyles = "rounded-[20px] border border-separator bg-raised shadow-raised";
