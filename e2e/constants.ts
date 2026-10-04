// Shared by e2e/serve.mjs (plain Node, which strips the types) and the specs.
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3217);

export type E2EUser = { email: string; name: string; password: string; role: "user" | "admin" };

/** Seeded into the throwaway database on every run; never real accounts. */
export const E2E_USERS = {
  admin: { email: "admin@e2e.test", name: "Klyde", password: "e2e-admin-password-1", role: "admin" },
  bea: { email: "bea@e2e.test", name: "Bea", password: "e2e-bea-password-123", role: "user" },
  dave: { email: "dave@e2e.test", name: "Dave", password: "e2e-dave-password-12", role: "user" },
} satisfies Record<string, E2EUser>;
