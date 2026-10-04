"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { removeShareAction, shareTabAction, updateShareAction } from "@/actions/shares";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import type { TabShareView } from "@/lib/tabs/types";

type Role = TabShareView["role"];

const ROLE_LABELS: Record<Role, string> = { viewer: "Can view", editor: "Can edit" };

/**
 * The owner shares the tab with friends' accounts by email (D19), choosing
 * view or edit for each, and can change or remove that at any time.
 */
export function SharingPanel({ tabId, shares }: { tabId: string; shares: TabShareView[] }) {
  return (
    <div className="space-y-5">
      <ShareForm tabId={tabId} />
      {shares.length === 0 ? (
        <p className="text-[15px] text-ink-secondary">Only you can see this tab.</p>
      ) : (
        <ul aria-label="Shared with" className="divide-y divide-separator border-t border-separator">
          {shares.map((share) => (
            <ShareRow key={share.userId} tabId={tabId} share={share} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareForm({ tabId }: { tabId: string }) {
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [done, setDone] = useState<TabShareView | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  // Uncontrolled inputs read at submit: what's typed before hydration is kept.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const role = form.get("role") === "editor" ? "editor" : "viewer";
    startTransition(async () => {
      const result = await shareTabAction({ tabId, email, role });
      if (result.ok) {
        setFailure(null);
        setDone(result.data);
        if (emailRef.current) emailRef.current.value = "";
      } else {
        setDone(null);
        setFailure(result);
      }
    });
  }

  const emailError = failure?.fieldErrors?.email;

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="share-email" className="block text-sm font-medium">
          Friend’s email
        </label>
        <input
          ref={emailRef}
          id="share-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          placeholder="friend@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "share-email-error" : undefined}
          className={inputStyles}
        />
        {emailError && (
          <p id="share-email-error" className="text-sm text-negative">
            {emailError}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="share-role" className="sr-only">
          Access
        </label>
        <select id="share-role" name="role" defaultValue="viewer" className={`${inputStyles} w-auto flex-1`}>
          <option value="viewer">{ROLE_LABELS.viewer}</option>
          <option value="editor">{ROLE_LABELS.editor}</option>
        </select>
        <button type="submit" disabled={isPending} className={`${buttonStyles.primary} shrink-0`}>
          {isPending ? "Sharing…" : "Share"}
        </button>
      </div>
      <ActionMessage failure={failure && !emailError ? failure : null} />
      {done && (
        <p role="status" className="text-sm text-positive">
          <span aria-hidden="true">✓ </span>
          Shared with {done.name} ({done.email}). They’ll see it under “Shared with you”.
        </p>
      )}
    </form>
  );
}

function ShareRow({ tabId, share }: { tabId: string; share: TabShareView }) {
  const [role, setRole] = useState<Role>(share.role);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectId = `share-role-${share.userId}`;

  function changeRole(next: Role) {
    const previous = role;
    setRole(next); // optimistic, rolled back visibly on failure
    startTransition(async () => {
      const result = await updateShareAction({ tabId, userId: share.userId, role: next });
      if (!result.ok) {
        setRole(previous);
        setFailure(result);
      } else {
        setFailure(null);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeShareAction({ tabId, userId: share.userId });
      if (!result.ok) {
        setFailure(result);
        setConfirming(false);
      }
    });
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">{share.name}</p>
          <p className="text-[13px] break-all text-ink-secondary">{share.email}</p>
        </div>
        {/* Keyed variants: a button swapped into the same slot must not be reused mid-tap. */}
        {confirming ? (
          <div key="confirm" role="group" aria-label={`Stop sharing with ${share.name}?`} className="flex flex-wrap gap-2">
            <button type="button" disabled={isPending} onClick={remove} className={buttonStyles.danger}>
              {isPending ? "Removing…" : "Remove"}
            </button>
            <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className={buttonStyles.quiet}>
              Cancel
            </button>
          </div>
        ) : (
          <div key="controls" className="flex flex-wrap gap-2">
            <label htmlFor={selectId} className="sr-only">
              Access for {share.name}
            </label>
            <select
              id={selectId}
              value={role}
              disabled={isPending}
              onChange={(event) => changeRole(event.target.value === "editor" ? "editor" : "viewer")}
              className={`${inputStyles} w-auto`}
            >
              <option value="viewer">{ROLE_LABELS.viewer}</option>
              <option value="editor">{ROLE_LABELS.editor}</option>
            </select>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${share.name}`}
              className={buttonStyles.quiet}
            >
              Remove
            </button>
          </div>
        )}
      </div>
      <ActionMessage failure={failure} />
    </li>
  );
}
