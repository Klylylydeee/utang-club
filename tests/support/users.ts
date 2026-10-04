import { randomBytes } from "node:crypto";
import type { Actor, UserRole } from "@/lib/auth/actor";
import { User } from "@/models/User";

let sequence = 0;

/**
 * Inserts a user directly (no scrypt work) and returns them as an Actor
 * plus the stored hash. The hash is well-formed but matches no password;
 * use registerUser in tests that need to sign in with a real password.
 */
export async function createTestUser(role: UserRole = "user", name?: string) {
  sequence += 1;
  const passwordHash = `scrypt:15:8:1:${randomBytes(16).toString("base64url")}:${randomBytes(32).toString("base64url")}`;
  const user = await User.create({
    name: name ?? `User ${sequence}`,
    email: `user${sequence}-${Date.now()}@example.test`,
    passwordHash,
    role,
  });
  const actor: Actor = { userId: user._id.toString(), role };
  return { ...actor, actor, id: actor.userId, email: user.email, passwordHash };
}
