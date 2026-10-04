/**
 * The Utang Club mark: two overlapping rounded squares (two people, one
 * tab) with a line running between them, in the current text colour.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="none">
      <rect x="3" y="7" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="9" width="16" height="16" rx="4.5" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2" />
      <path d="M9 16h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
