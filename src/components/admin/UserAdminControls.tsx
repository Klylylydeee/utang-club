"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { resetUserPasswordAction, setUserRoleAction, setUserStatusAction } from "@/actions/admin";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { errorProps, Field } from "@/components/ui/Field";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordRules";
import type { UserSummary } from "@/lib/users/types";

type Pending = "status" | "role" | null;

/**
 * Disable/enable, change role, and set a new password for another user
 * (D17). The first two ask for confirmation inline; every result is
 * announced. Keyed confirm rows, so a button is never reused as another.
 */
export function UserAdminControls({ user }: { user: UserSummary }) {
  const [confirming, setConfirming] = useState<Pending>(null);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const disabled = user.status === "disabled";
  const isAdmin = user.role === "admin";

  function run(action: () => Promise<{ ok: true } | ActionFailure>, done: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setConfirming(null);
      if (result.ok) {
        setFailure(null);
        setNotice(done);
      } else {
        setFailure(result);
      }
    });
  }

  function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const result = await resetUserPasswordAction({ userId: user.id, password });
      if (result.ok) setPassword("");
      return result;
    }, `${user.name}'s password was changed and they were signed out everywhere.`);
  }

  const passwordError = failure?.fieldErrors?.password;

  return (
    <div className="space-y-5">
      <ControlRow
        title={disabled ? "Account disabled" : "Account active"}
        body={disabled ? "They can't sign in. Their tabs are kept." : "Disabling signs them out everywhere. Their tabs are kept."}
      >
        {confirming === "status" ? (
          <ConfirmRow
            key="confirm-status"
            question={disabled ? `Enable ${user.name}?` : `Disable ${user.name}?`}
            confirmLabel={disabled ? "Enable" : "Disable"}
            danger={!disabled}
            pending={isPending}
            onCancel={() => setConfirming(null)}
            onConfirm={() =>
              run(
                () => setUserStatusAction({ userId: user.id, status: disabled ? "active" : "disabled" }),
                disabled ? `${user.name} can sign in again.` : `${user.name} was disabled and signed out.`,
              )
            }
          />
        ) : (
          <button key="status" type="button" onClick={() => setConfirming("status")} className={disabled ? buttonStyles.secondary : buttonStyles.danger}>
            {disabled ? "Enable account" : "Disable account"}
          </button>
        )}
      </ControlRow>

      <ControlRow
        title={isAdmin ? "Administrator" : "Regular user"}
        body={isAdmin ? "Can view every tab and manage users." : "Sees only their own tabs."}
      >
        {confirming === "role" ? (
          <ConfirmRow
            key="confirm-role"
            question={isAdmin ? `Remove ${user.name}'s admin access?` : `Make ${user.name} an administrator?`}
            confirmLabel={isAdmin ? "Remove access" : "Make administrator"}
            danger={isAdmin}
            pending={isPending}
            onCancel={() => setConfirming(null)}
            onConfirm={() =>
              run(
                () => setUserRoleAction({ userId: user.id, role: isAdmin ? "user" : "admin" }),
                isAdmin ? `${user.name} is now a regular user.` : `${user.name} is now an administrator.`,
              )
            }
          />
        ) : (
          <button key="role" type="button" onClick={() => setConfirming("role")} className={buttonStyles.secondary}>
            {isAdmin ? "Remove admin access" : "Make administrator"}
          </button>
        )}
      </ControlRow>

      <form onSubmit={resetPassword} className="space-y-3 border-t border-separator pt-5" noValidate>
        <Field
          id="new-password"
          label="Set a new password"
          error={passwordError}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. Tell ${user.name} in person; there's no email reset.`}
        >
          <input
            {...errorProps("new-password", passwordError)}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputStyles}
          />
        </Field>
        <button type="submit" disabled={isPending || password.length === 0} className={buttonStyles.secondary}>
          {isPending ? "Saving…" : "Set password"}
        </button>
      </form>

      <div aria-live="polite">
        {notice && <p className="rounded-lg bg-positive-soft px-3 py-2.5 text-[15px] text-positive">{notice}</p>}
        {failure && !passwordError && <ActionMessage failure={failure} />}
      </div>
    </div>
  );
}

function ControlRow(props: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="font-medium">{props.title}</p>
        <p className="text-[13px] text-ink-secondary">{props.body}</p>
      </div>
      {props.children}
    </div>
  );
}

function ConfirmRow(props: {
  question: string;
  confirmLabel: string;
  danger: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div role="group" aria-label={props.question} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2.5">
      <span className="mr-auto text-[15px]">{props.question}</span>
      <button type="button" onClick={props.onCancel} disabled={props.pending} className={buttonStyles.quiet}>
        Cancel
      </button>
      <button
        type="button"
        onClick={props.onConfirm}
        disabled={props.pending}
        className={props.danger ? buttonStyles.danger : buttonStyles.primary}
      >
        {props.pending ? "Saving…" : props.confirmLabel}
      </button>
    </div>
  );
}
