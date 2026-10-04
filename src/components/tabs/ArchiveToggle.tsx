"use client";

import { useState, useTransition } from "react";
import { setTabArchivedAction } from "@/actions/tabs";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

/** Archive asks for confirmation (it locks the tab); unarchive is immediate. */
export function ArchiveToggle({ tabId, archived }: { tabId: string; archived: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (nextArchived: boolean) =>
    startTransition(async () => {
      const result = await setTabArchivedAction({ tabId, archived: nextArchived });
      setFailure(result.ok ? null : result);
      setConfirming(false);
    });

  if (archived) {
    return (
      <div className="space-y-2">
        <button type="button" disabled={isPending} onClick={() => apply(false)} className={buttonStyles.secondary}>
          {isPending ? "Unarchiving…" : "Unarchive"}
        </button>
        <ActionMessage failure={failure} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm archive">
          <span className="text-sm">Archive this tab? It becomes read-only.</span>
          <button type="button" disabled={isPending} onClick={() => apply(true)} className={buttonStyles.primary}>
            {isPending ? "Archiving…" : "Archive"}
          </button>
          <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className={buttonStyles.quiet}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={buttonStyles.secondary}>
          Archive tab
        </button>
      )}
      <ActionMessage failure={failure} />
    </div>
  );
}
