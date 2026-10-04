"use client";

import { useState, useTransition } from "react";
import { restoreTransactionAction } from "@/actions/transactions";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, iconButtonStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

export type DeletedRef = { id: string; description: string };

/**
 * "Deleted “Ramen”. Undo" right after a delete. Deleting only hides a row,
 * so Undo restores it as it was. Stays until dismissed or replaced; the
 * row is also in "Recently deleted" below the transactions.
 */
export function UndoDeleteNotice({ deleted, onDone }: { deleted: DeletedRef | null; onDone: () => void }) {
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  if (!deleted) return null;

  function undo() {
    if (!deleted) return;
    startTransition(async () => {
      const result = await restoreTransactionAction({ transactionId: deleted.id });
      if (result.ok) {
        setFailure(null);
        onDone();
      } else {
        setFailure(result);
      }
    });
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-separator bg-raised py-1 pr-1 pl-4 shadow-raised">
      <p className="min-w-0 flex-1 text-[15px] break-words">
        Deleted “{deleted.description || "transaction"}”.
      </p>
      <button type="button" onClick={undo} disabled={isPending} className={buttonStyles.tinted}>
        {isPending ? "Restoring…" : "Undo"}
      </button>
      <button type="button" onClick={onDone} aria-label="Dismiss" className={iconButtonStyles}>
        <span aria-hidden="true">✕</span>
      </button>
      {failure && (
        <div className="basis-full pb-2">
          <ActionMessage failure={failure} />
        </div>
      )}
    </div>
  );
}
