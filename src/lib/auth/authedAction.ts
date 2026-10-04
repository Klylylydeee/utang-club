import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { DomainError, type ActionResult } from "@/lib/actions/result";
import { actorFrom, type Actor } from "./actor";
import { getSession } from "./session";
import type { ActiveSession } from "./sessionStore";

/** `actor` is what services take for access checks (D15). */
export type ActionContext = { session: ActiveSession; actor: Actor };

/**
 * The only way to define a Server Action (enforced by
 * tests/auth/actionsAreAuthed.test.ts). Order matters:
 *   1. session check (before touching input),
 *   2. Zod validation of untrusted input,
 *   3. the handler, with expected DomainErrors mapped to results and
 *      anything else logged server-side and reported generically.
 *
 * An expired session returns `unauthenticated` instead of redirecting, so
 * the client can keep unsaved edits and ask the user to sign in again.
 */
export function authedAction<Schema extends z.ZodType, Result>(
  schema: Schema,
  handler: (input: z.output<Schema>, context: ActionContext) => Promise<Result>,
): (input: z.input<Schema>) => Promise<ActionResult<Result>> {
  return async (input) => {
    let session: ActiveSession | null;
    try {
      session = await getSession();
    } catch (error) {
      console.error("[action] session check failed:", error instanceof Error ? error.message : error);
      return { ok: false, code: "server", error: "Something went wrong. Please try again." };
    }
    if (!session) {
      return { ok: false, code: "unauthenticated", error: "Your session has ended. Sign in again to continue." };
    }

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, code: "validation", error: "Please fix the highlighted fields.", fieldErrors };
    }

    try {
      return { ok: true, data: await handler(parsed.data, { session, actor: actorFrom(session.user) }) };
    } catch (error) {
      unstable_rethrow(error); // let redirect()/notFound() through
      if (error instanceof DomainError) {
        return { ok: false, code: error.code, error: error.message, fieldErrors: error.fieldErrors };
      }
      console.error("[action] failed:", error);
      return { ok: false, code: "server", error: "Something went wrong. Your change was not saved." };
    }
  };
}
