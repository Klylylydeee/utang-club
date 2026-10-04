"use client";

import { useState, useTransition } from "react";
import { restoreTransactionAction } from "@/actions/transactions";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

/** Puts a deleted row back as it was. The list refreshes from the server afterwards. */
export function RestoreTransactionButton({ transactionId, description }: { transactionId: string; description: string }) {
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      const result = await restoreTransactionAction({ transactionId });
      setFailure(result.ok ? null : result);
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={restore}
        disabled={isPending}
        aria-label={`Restore ${description}`}
        className={buttonStyles.secondary}
      >
        {isPending ? "Restoring…" : "Restore"}
      </button>
      <ActionMessage failure={failure} />
    </div>
  );
}
