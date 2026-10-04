import type { UserRole } from "@/lib/auth/actor";

/** A user as the admin area sees them. Never includes the password hash. */
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "disabled";
  tabCount: number;
  /** ISO 8601. */
  createdAt: string;
};
