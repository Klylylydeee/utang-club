"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { addPersonAction } from "@/actions/people";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import type { PersonSummary } from "@/lib/tabs/types";
import { PersonRow } from "./PersonRow";

export function PeoplePanel(props: { tabId: string; people: PersonSummary[]; readOnly: boolean }) {
  return (
    <div className="space-y-5">
      {!props.readOnly && <AddPersonForm tabId={props.tabId} />}
      {props.people.length === 0 ? (
        <p className="rounded-lg border border-dashed border-separator px-4 py-6 text-center text-ink-secondary">
          No one here yet. Add at least two people to start recording who owes whom.
        </p>
      ) : (
        <ul className="divide-y divide-separator" aria-label="People in this tab">
          {props.people.map((person) => (
            <PersonRow key={person.id} person={person} readOnly={props.readOnly} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Fast entry: type a name, press Enter, keep typing the next one. The input
 * is uncontrolled so a name typed before hydration isn't reset to "".
 */
function AddPersonForm({ tabId }: { tabId: string }) {
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputRef.current;
    const name = input?.value ?? "";
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await addPersonAction({ tabId, displayName: name });
      if (result.ok) {
        // Clear only if nothing new was typed while saving.
        if (input && input.value === name) input.value = "";
        setFailure(null);
      } else {
        setFailure(result); // keep the typed name so nothing is lost
      }
      inputRef.current?.focus();
    });
  }

  const nameError = failure?.fieldErrors?.displayName;

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <label htmlFor="new-person" className="block text-sm font-medium">
        Add a person
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="new-person"
          name="displayName"
          placeholder="Name, e.g. Bea"
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "new-person-error" : undefined}
          className={inputStyles}
        />
        <button type="submit" disabled={isPending} className={`${buttonStyles.primary} shrink-0`}>
          {isPending ? "Adding…" : "Add"}
        </button>
      </div>
      {nameError ? (
        <p id="new-person-error" className="text-sm text-negative">
          {nameError}
        </p>
      ) : (
        <ActionMessage failure={failure} />
      )}
    </form>
  );
}
