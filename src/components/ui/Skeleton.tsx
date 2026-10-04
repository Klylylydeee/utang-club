/** A placeholder block. Pulses gently; still under reduced motion (globals.css). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[10px] bg-separator/60 ${className}`} />;
}
