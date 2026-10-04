import type { UserRole } from "@/lib/auth/actor";

/** Role and status as words with a shape, never colour alone. */
export function RoleBadge({ role }: { role: UserRole }) {
  return role === "admin" ? (
    <span className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 text-[13px] font-medium text-accent">
      Administrator
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-separator px-2 py-0.5 text-[13px] text-ink-secondary">
      User
    </span>
  );
}

export function StatusPill({ status }: { status: "active" | "disabled" }) {
  return status === "active" ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
      <span aria-hidden="true" className="size-2 rounded-full bg-positive" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-negative">
      <span aria-hidden="true" className="size-2 rounded-full border-2 border-negative" />
      Disabled
    </span>
  );
}
