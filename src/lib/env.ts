import "server-only";
import { z } from "zod";

/**
 * Validated server-only environment, read lazily so `next build` needs no
 * secrets. Split by concern so a missing auth variable reports itself
 * clearly instead of breaking unrelated code. Both fail closed.
 */

const databaseEnvSchema = z.object({
  MONGODB_URI: z
    .string({ error: "MONGODB_URI is required. Copy .env.example to .env.local." })
    .trim()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),
});

/** Accounts live in MongoDB (D15); the env only holds the throttle key. */
const authEnvSchema = z.object({
  AUTH_SECRET: z
    .string({ error: "AUTH_SECRET is required (at least 32 random characters)." })
    .trim()
    .min(32, "AUTH_SECRET must be at least 32 characters."),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;

export class ServerEnvError extends Error {
  override name = "ServerEnvError";
}

function parse<T>(schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new ServerEnvError(`Invalid server environment: ${details}`);
  }
  return parsed.data;
}

let databaseEnv: DatabaseEnv | undefined;
let authEnv: AuthEnv | undefined;

export function getDatabaseEnv(): DatabaseEnv {
  return (databaseEnv ??= parse(databaseEnvSchema));
}

export function getAuthEnv(): AuthEnv {
  return (authEnv ??= parse(authEnvSchema));
}
