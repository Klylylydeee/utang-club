import "server-only";
import { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import type { Actor, UserRole } from "@/lib/auth/actor";
import { hashPassword } from "@/lib/auth/password";
import { deleteUserSessions } from "@/lib/auth/sessionStore";
import { connectToDatabase } from "@/lib/db/connect";
import { Tab } from "@/models/Tab";
import { User } from "@/models/User";
import type {
  RegisterInput,
  ResetUserPasswordInput,
  SetUserRoleInput,
  SetUserStatusInput,
} from "@/schemas/account";
import type { UserSummary } from "./types";

/**
 * Accounts (D15) and admin user management (D17). Inputs are Zod-validated
 * and emails already normalized. Admin functions check the actor's role
 * themselves; callers don't have to remember to.
 */

type UserDoc = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled";
  passwordHash: string;
  createdAt: Date;
};

const DUPLICATE_EMAIL = "An account with this email already exists. Sign in instead.";

/** Creates a regular account. The first admin is made with `pnpm create-admin`. */
export async function registerUser(input: RegisterInput): Promise<{ id: string; passwordHash: string }> {
  await connectToDatabase();
  if (await User.exists({ email: input.email })) {
    throw new DomainError("conflict", DUPLICATE_EMAIL, { email: DUPLICATE_EMAIL });
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await User.create({ name: input.name, email: input.email, passwordHash, role: "user" });
    return { id: user._id.toString(), passwordHash };
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 11000) {
      throw new DomainError("conflict", DUPLICATE_EMAIL, { email: DUPLICATE_EMAIL });
    }
    throw error;
  }
}

/** What sign-in needs, or null. The email must already be normalized. */
export async function findUserForSignIn(
  email: string,
): Promise<{ id: string; passwordHash: string; status: "active" | "disabled" } | null> {
  await connectToDatabase();
  const user = await User.findOne({ email }, { passwordHash: 1, status: 1 }).lean<UserDoc>();
  return user ? { id: user._id.toString(), passwordHash: user.passwordHash, status: user.status } : null;
}

// --- Admin ---

function assertAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new DomainError("not-found", "This page doesn't exist.");
}

function toSummary(user: UserDoc, tabCount: number): UserSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    tabCount,
    createdAt: user.createdAt.toISOString(),
  };
}

async function tabCounts(userIds: Types.ObjectId[]) {
  const rows = await Tab.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ownerId: { $in: userIds } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

/** Everyone, newest first. */
export async function listUsers(actor: Actor): Promise<UserSummary[]> {
  assertAdmin(actor);
  await connectToDatabase();
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean<UserDoc[]>();
  const counts = await tabCounts(users.map((user) => user._id));
  return users.map((user) => toSummary(user, counts.get(user._id.toString()) ?? 0));
}

export async function getUserSummary(userId: string, actor: Actor): Promise<UserSummary | null> {
  assertAdmin(actor);
  await connectToDatabase();
  const user = await User.findById(new Types.ObjectId(userId), { passwordHash: 0 }).lean<UserDoc>();
  if (!user) return null;
  const counts = await tabCounts([user._id]);
  return toSummary(user, counts.get(userId) ?? 0);
}

async function loadOtherUser(userId: string, actor: Actor) {
  assertAdmin(actor);
  await connectToDatabase();
  if (userId === actor.userId) {
    throw new DomainError("conflict", "You can't change your own account here. Ask another administrator.");
  }
  const user = await User.findById(new Types.ObjectId(userId), { _id: 1 }).lean();
  if (!user) throw new DomainError("not-found", "This account no longer exists.");
  return user;
}

/** Disabling signs the user out everywhere; their tabs are kept. */
export async function setUserStatus(input: SetUserStatusInput, actor: Actor): Promise<void> {
  const user = await loadOtherUser(input.userId, actor);
  await User.updateOne({ _id: user._id }, { $set: { status: input.status } });
  if (input.status === "disabled") await deleteUserSessions(input.userId);
}

/** You can't change your own role, so there is always at least one admin. */
export async function setUserRole(input: SetUserRoleInput, actor: Actor): Promise<void> {
  const user = await loadOtherUser(input.userId, actor);
  await User.updateOne({ _id: user._id }, { $set: { role: input.role } });
}

/** Sets a new password (there is no email reset) and signs them out everywhere. */
export async function resetUserPassword(input: ResetUserPasswordInput, actor: Actor): Promise<void> {
  const user = await loadOtherUser(input.userId, actor);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(input.password) } });
  await deleteUserSessions(input.userId);
}
