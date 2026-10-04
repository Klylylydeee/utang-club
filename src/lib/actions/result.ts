/**
 * The shape every Server Action returns. Client-safe (no server imports).
 * Field errors are keyed by input field name for inline display.
 */
export type ActionErrorCode =
  | "unauthenticated"
  | "validation"
  | "not-found"
  | "conflict"
  | "read-only"
  | "in-use"
  | "server";

export type ActionFailure = {
  ok: false;
  code: ActionErrorCode;
  error: string;
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

/** Thrown by domain services for expected failures; mapped to ActionFailure. */
export class DomainError extends Error {
  override name = "DomainError";

  constructor(
    readonly code: Exclude<ActionErrorCode, "unauthenticated" | "server">,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
