import Link from "next/link";
import { buttonStyles, cardStyles } from "@/components/ui/styles";

/**
 * Unknown pages, and tabs you may not see: the same answer either way, so
 * nobody can tell whether a tab exists (AGENTS.md: "not found", never "forbidden").
 */
export function NotFoundCard() {
  return (
    <section className={`${cardStyles} mx-auto max-w-md space-y-4 px-6 py-10 text-center`}>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-ink-secondary">This page doesn’t exist, or it isn’t shared with you.</p>
      </div>
      <Link href="/" className={buttonStyles.primary}>
        Go to tabs
      </Link>
    </section>
  );
}
