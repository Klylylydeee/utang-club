"use client";

import { useState, useTransition } from "react";
import { leaveTabAction } from "@/actions/shares";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

/** Someone a tab was shared with removes it from their list (D19). Asks first: only the owner can share it again. */
export function LeaveTabButton({ tabId }: { tabId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      // On success the action redirects to the tab list; only failures come back.
      const result = await leaveTabAction({ tabId });
      if (!result.ok) {
        setFailure(result);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="shrink-0 space-y-2">
      {/* Keyed variants: a button swapped into the same slot must not be reused mid-tap. */}
      {confirming ? (
        <div key="confirm" role="group" aria-label="Remove this tab from your list?" className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Only its owner can share it again.</span>
          <button type="button" disabled={isPending} onClick={leave} className={buttonStyles.danger}>
            {isPending ? "Removing…" : "Remove"}
          </button>
          <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className={buttonStyles.quiet}>
            Cancel
          </button>
        </div>
      ) : (
        <button key="leave" type="button" onClick={() => setConfirming(true)} className={buttonStyles.secondary}>
          Remove from my tabs
        </button>
      )}
      <ActionMessage failure={failure} />
    </div>
  );
}
