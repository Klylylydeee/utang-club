"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut, signOutEverywhere } from "@/actions/session";

/** Native <details> menu: keyboard- and touch-friendly, no hover needed. */
export function AccountMenu() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: typeof signOut) =>
    startTransition(async () => {
      setError(null);
      const result = await action(undefined);
      // Only reached when the action did not redirect.
      if (!result.ok) {
        if (result.code === "unauthenticated") router.replace("/login");
        else setError(result.error);
      }
    });

  return (
    <details className="group relative">
      <summary className="inline-flex min-h-11 list-none items-center rounded-lg px-3 text-[15px] text-ink-secondary transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        Account
        <span aria-hidden="true" className="ml-1 text-xs transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-separator bg-raised p-1 shadow-raised">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(signOut)}
          className="flex min-h-11 w-full items-center rounded-lg px-3 text-left hover:bg-accent-soft disabled:opacity-60"
        >
          Sign out
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(signOutEverywhere)}
          className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-negative hover:bg-accent-soft disabled:opacity-60"
        >
          Sign out on all devices
        </button>
        {error && (
          <p role="alert" className="px-3 py-2 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
