"use client";

import { useState, useTransition, type FormEvent } from "react";
import { deletePersonAction, renamePersonAction } from "@/actions/people";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import type { PersonSummary } from "@/lib/tabs/types";
import { pluralize } from "@/lib/text";

type Mode = "view" | "rename" | "confirm-remove";

/** One person: view, inline rename, or two-step remove (D5). No hover-only controls. */
export function PersonRow({ person, readOnly }: { person: PersonSummary; readOnly: boolean }) {
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(person.displayName);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const inUse = person.transactionCount > 0;
  const inputId = `rename-${person.id}`;

  function cancel() {
    setDraft(person.displayName);
    setFailure(null);
    setMode("view");
  }

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renamePersonAction({ personId: person.id, displayName: draft });
      if (result.ok) {
        setMode("view");
        setFailure(null);
      } else {
        setFailure(result);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePersonAction({ personId: person.id });
      if (!result.ok) {
        setFailure(result);
        setMode("view");
      }
    });
  }

  if (mode === "rename") {
    const nameError = failure?.fieldErrors?.displayName;
    return (
      <li className="py-3">
        <form onSubmit={rename} className="space-y-2" noValidate>
          <label htmlFor={inputId} className="sr-only">
            New name for {person.displayName}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancel();
              }}
              maxLength={60}
              autoFocus
              aria-invalid={nameError ? true : undefined}
              className={`${inputStyles} min-w-0 flex-1 basis-48`}
            />
            <button type="submit" disabled={isPending || !draft.trim()} className={buttonStyles.primary}>
              {isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancel} className={buttonStyles.quiet}>
              Cancel
            </button>
          </div>
          {nameError ? <p className="text-sm text-negative">{nameError}</p> : <ActionMessage failure={failure} />}
        </form>
      </li>
    );
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{person.displayName}</p>
          <p className="text-sm text-ink-secondary">{pluralize(person.transactionCount, "transaction")}</p>
        </div>

        {!readOnly && mode === "view" && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("rename")}
              className={buttonStyles.quiet}
              aria-label={`Rename ${person.displayName}`}
            >
              Rename
            </button>
            {!inUse && (
              <button
                type="button"
                onClick={() => setMode("confirm-remove")}
                className={buttonStyles.quiet}
                aria-label={`Remove ${person.displayName}`}
              >
                Remove
              </button>
            )}
          </div>
        )}

        {!readOnly && mode === "confirm-remove" && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm removing ${person.displayName}`}>
            <span className="text-sm">Remove {person.displayName}?</span>
            <button type="button" disabled={isPending} onClick={remove} className={buttonStyles.danger}>
              {isPending ? "Removing…" : "Remove"}
            </button>
            <button type="button" disabled={isPending} onClick={() => setMode("view")} className={buttonStyles.quiet}>
              Cancel
            </button>
          </div>
        )}
      </div>
      <ActionMessage failure={failure} />
    </li>
  );
}
