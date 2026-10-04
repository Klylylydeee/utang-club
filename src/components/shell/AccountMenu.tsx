"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut } from "@/actions/session";
import type { SessionUser } from "@/lib/auth/actor";

/** Native <details> menu on the navy bar: keyboard- and touch-friendly, no hover needed. */
export function AccountMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const run = () =>
    startTransition(async () => {
      setError(null);
      const result = await signOut(undefined);
      // Only reached when the action did not redirect.
      if (!result.ok) {
        if (result.code === "unauthenticated") router.replace("/login");
        else setError(result.error);
      }
    });

  return (
    <details className="group relative">
      <summary
        aria-label={`Account: ${user.name}`}
        className="inline-flex min-h-11 list-none items-center gap-2 rounded-lg px-2 text-[15px] text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-ink [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-shell-hover text-[13px] font-semibold text-shell-ink"
        >
          {initials || "?"}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-[10px] border border-separator bg-raised p-1 text-ink shadow-raised">
        <div className="border-b border-separator px-3 pt-2 pb-2.5">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-[13px] text-ink-secondary">{user.email}</p>
          {user.role === "admin" && <p className="mt-1 text-[13px] font-medium text-accent">Administrator</p>}
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={run}
          className="mt-1 flex min-h-11 w-full items-center rounded-lg px-3 text-left hover:bg-accent-soft disabled:opacity-60"
        >
          Sign out
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
