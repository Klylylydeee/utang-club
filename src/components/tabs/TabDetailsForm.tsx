"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateTabDetailsAction } from "@/actions/tabs";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

export function TabDetailsForm(props: { tabId: string; name: string; description: string }) {
  const [name, setName] = useState(props.name);
  const [description, setDescription] = useState(props.description);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = name !== props.name || description !== props.description;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTabDetailsAction({ tabId: props.tabId, name, description });
      setFailure(result.ok ? null : result);
      setSaved(result.ok);
    });
  }

  const nameError = failure?.fieldErrors?.name;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="tab-details-name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="tab-details-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
          maxLength={80}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "tab-details-name-error" : undefined}
          className={inputStyles}
        />
        {nameError && (
          <p id="tab-details-name-error" className="text-sm text-negative">
            {nameError}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="tab-details-description" className="block text-sm font-medium">
          Note <span className="font-normal text-ink-secondary">(optional)</span>
        </label>
        <input
          id="tab-details-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setSaved(false);
          }}
          maxLength={500}
          className={inputStyles}
        />
      </div>
      <ActionMessage failure={failure && !nameError ? failure : null} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending || !dirty} className={buttonStyles.secondary}>
          {isPending ? "Saving…" : "Save details"}
        </button>
        <span role="status" className="text-sm text-ink-secondary">
          {saved && !dirty ? "Saved" : ""}
        </span>
      </div>
    </form>
  );
}
