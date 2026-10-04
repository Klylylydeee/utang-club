import { z } from "zod";
import { objectIdSchema, requiredText } from "./common";

/**
 * Canonical key for case-insensitive duplicate detection within a tab:
 * "  ADRIAN  " and "adrian" collide; "Adrián" and "Adrian" do not.
 */
export function normalizePersonName(displayName: string): string {
  return displayName.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export const personInputSchema = z.object({
  tabId: objectIdSchema,
  displayName: requiredText("Name", 60),
});

export type PersonInput = z.infer<typeof personInputSchema>;

export const personUpdateSchema = z.object({
  personId: objectIdSchema,
  displayName: requiredText("Name", 60),
});

export type PersonUpdate = z.infer<typeof personUpdateSchema>;

export const personDeleteSchema = z.object({
  personId: objectIdSchema,
});

export type PersonDelete = z.infer<typeof personDeleteSchema>;
