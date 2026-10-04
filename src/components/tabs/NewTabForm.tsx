"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createTabAction } from "@/actions/tabs";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

export function NewTabForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createTabAction({ name, description });
      if (result.ok) {
        router.push(`/tabs/${result.data.id}`);
      } else {
        setFailure(result);
      }
    });
  }

  const nameError = failure?.fieldErrors?.name;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="tab-name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="tab-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          autoFocus
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "tab-name-error" : undefined}
          className={inputStyles}
        />
        {nameError && (
          <p id="tab-name-error" className="text-sm text-negative">
            {nameError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tab-description" className="block text-sm font-medium">
          Note <span className="font-normal text-ink-secondary">(optional)</span>
        </label>
        <input
          id="tab-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          placeholder="e.g. Rent, groceries and the Baguio weekend"
          className={inputStyles}
        />
      </div>

      <ActionMessage failure={failure && !nameError ? failure : null} />

      <button type="submit" disabled={isPending} className={`${buttonStyles.primary} w-full`}>
        {isPending ? "Creating…" : "Create tab"}
      </button>
    </form>
  );
}
