"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null, email: "" };

/** Works without JavaScript too (a plain form post to the Server Action). */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const invalid = state.error ? true : undefined;
  const describedBy = state.error ? "login-error" : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
          key={state.email}
          required
          autoFocus
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={inputStyles}
        />
      </Field>
      <Field id="password" label="Password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={inputStyles}
        />
      </Field>

      {/* Rendered only on error, so there's no empty gap; role=alert announces it on insert. */}
      {state.error && (
        <p id="login-error" role="alert" className="rounded-lg bg-negative/10 px-3 py-2.5 text-[15px] text-negative">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={`${buttonStyles.primary} w-full`}>
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
