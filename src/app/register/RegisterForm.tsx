"use client";

import { useActionState } from "react";
import { errorProps, Field } from "@/components/ui/Field";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordRules";
import { register, type RegisterState } from "./actions";

const initialState: RegisterState = { error: null, fieldErrors: {}, values: { name: "", email: "" } };

/**
 * Validated on the server (registerSchema); errors come back per field.
 * Name and email are kept after an error; passwords are never sent back.
 */
export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState);
  const errors = state.fieldErrors;
  // Remount the inputs with the submitted values after each response.
  const formKey = `${state.values.name}|${state.values.email}|${Object.keys(errors).join()}`;

  return (
    <form action={formAction} className="space-y-4" noValidate key={formKey}>
      <Field id="name" label="Your name" error={errors.name} hint="Shown to you and your administrator.">
        <input
          {...errorProps("name", errors.name)}
          name="name"
          autoComplete="name"
          defaultValue={state.values.name}
          maxLength={60}
          required
          autoFocus
          className={inputStyles}
        />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <input
          {...errorProps("email", errors.email)}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.values.email}
          maxLength={254}
          required
          className={inputStyles}
        />
      </Field>
      <Field
        id="password"
        label="Password"
        error={errors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well.`}
      >
        <input
          {...errorProps("password", errors.password)}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className={inputStyles}
        />
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
        <input
          {...errorProps("confirmPassword", errors.confirmPassword)}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputStyles}
        />
      </Field>

      {(state.error || errors.form) && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2.5 text-[15px] text-negative">
          {state.error ?? errors.form}
        </p>
      )}

      <button type="submit" disabled={isPending} className={`${buttonStyles.primary} w-full`}>
        {isPending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}
