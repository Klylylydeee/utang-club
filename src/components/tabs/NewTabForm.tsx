"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createTabAction } from "@/actions/tabs";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";

/**
 * The inputs are uncontrolled and read at submit, so anything typed before
 * the page hydrates (a slow phone) is kept instead of being reset to "".
 */
export function NewTabForm() {
  const router = useRouter();
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
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
          name="name"
          maxLength={80}
          placeholder="e.g. Japan trip, Friday inuman, Bea’s birthday dinner"
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
          name="description"
          maxLength={500}
          placeholder="e.g. Osaka and Kyoto, 12–18 March"
          className={inputStyles}
        />
      </div>

      <ActionMessage failure={failure && !nameError ? failure : null} />

      <button type="submit" disabled={isPending} className={`${buttonStyles.primary} w-full sm:w-auto`}>
        {isPending ? "Creating…" : "Create tab"}
      </button>
    </form>
  );
}
