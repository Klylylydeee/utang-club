import { z } from "zod";

/** A 24-hex-character MongoDB ObjectId, validated before any query runs. */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

/** Trims, collapses inner whitespace, and treats "" as absent. */
export function optionalText(maxLength: number) {
  return z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(maxLength, `Must be ${maxLength} characters or fewer`))
    .optional()
    .transform((value) => (value ? value : undefined));
}

/** Trims and collapses inner whitespace; required and non-empty. */
export function requiredText(label: string, maxLength: number) {
  return z
    .string({ error: `${label} is required` })
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .max(maxLength, `${label} must be ${maxLength} characters or fewer`),
    );
}
