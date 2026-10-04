import { transactionInputSchema } from "@/schemas/transaction";
import { toActionInput, type RowValues } from "./rowValues";

/**
 * Runs the server's own schema in the browser for instant, field-level
 * feedback. Returns field errors keyed like ActionFailure.fieldErrors, or
 * null when the row is valid. The server still re-validates every write.
 */
export function validateRow(tabId: string, values: RowValues): Record<string, string> | null {
  const parsed = transactionInputSchema.safeParse(toActionInput(tabId, values));
  if (parsed.success) return null;
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    fieldErrors[issue.path.join(".") || "form"] ??= issue.message;
  }
  return fieldErrors;
}
