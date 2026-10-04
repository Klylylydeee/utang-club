"use client";

import Link from "next/link";
import { buttonStyles, cardStyles } from "@/components/ui/styles";

/**
 * Unexpected errors in any signed-in page. The app bar stays (this sits
 * inside the (app) layout). Production errors from the server carry no
 * detail, only a reference that matches the server log.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section role="alert" className={`${cardStyles} mx-auto max-w-lg space-y-4 px-6 py-10 text-center`}>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-ink-secondary">
          Nothing you saved is lost. Try again, or go back to your tabs.
        </p>
        {error.digest && <p className="text-[13px] text-ink-secondary">Reference: {error.digest}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className={buttonStyles.primary}>
          Try again
        </button>
        <Link href="/" className={buttonStyles.secondary}>
          Go to tabs
        </Link>
      </div>
    </section>
  );
}
