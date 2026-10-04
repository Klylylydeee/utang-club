import Link from "next/link";
import type { ActionFailure } from "@/lib/actions/result";

/**
 * Shows an action failure. For an expired session it offers a sign-in link
 * that opens in a new tab, so unsaved input on this page is not lost.
 */
export function ActionMessage({ failure }: { failure: ActionFailure | null }) {
  if (!failure) return null;
  return (
    <p role="alert" className="text-sm text-negative">
      {failure.error}
      {failure.code === "unauthenticated" && (
        <>
          {" "}
          <Link href="/login" target="_blank" className="font-medium underline underline-offset-2">
            Sign in
          </Link>{" "}
          in a new window, then try again here.
        </>
      )}
    </p>
  );
}
