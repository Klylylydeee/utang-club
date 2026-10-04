/**
 * Shared control styles. Every interactive control is at least 44px tall
 * (min-h-11) per UI_SPEC.md → Touch interaction rules.
 */

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-[background-color,color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-accent-ink hover:bg-accent-hover`,
  secondary: `${buttonBase} border border-separator bg-raised text-ink hover:bg-accent-soft`,
  quiet: `${buttonBase} text-ink-secondary hover:bg-accent-soft hover:text-ink`,
  danger: `${buttonBase} border border-separator bg-raised text-negative hover:bg-accent-soft`,
} as const;

export const inputStyles =
  "block min-h-11 w-full rounded-xl border border-separator bg-surface px-3.5 text-ink outline-none transition-colors placeholder:text-ink-secondary/70 focus:border-accent aria-[invalid=true]:border-negative";

export const cardStyles = "rounded-2xl border border-separator bg-raised shadow-raised";
