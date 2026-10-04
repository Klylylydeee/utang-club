import type { ReactNode } from "react";

/** A labelled form field with an inline error, for sheets and forms. */
export function Field(props: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.id} className="block text-sm font-medium">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p id={`${props.id}-error`} className="text-sm text-negative">
          {props.error}
        </p>
      ) : (
        props.hint && <p className="text-sm text-ink-secondary">{props.hint}</p>
      )}
    </div>
  );
}

/** aria props that tie an input to its Field error. */
export function errorProps(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}
