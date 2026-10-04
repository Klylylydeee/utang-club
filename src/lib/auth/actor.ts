/**
 * Who is acting, passed into every domain service (D15). Services decide
 * access from this alone; they never read cookies or headers.
 */
export type UserRole = "user" | "admin";

export type Actor = {
  userId: string;
  role: UserRole;
};

/** The signed-in user as pages and the account menu see them. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function actorFrom(user: SessionUser): Actor {
  return { userId: user.id, role: user.role };
}
