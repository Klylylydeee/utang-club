import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { RoleBadge, StatusPill } from "@/components/admin/UserBadges";
import { actorFrom } from "@/lib/auth/actor";
import { requireAdmin } from "@/lib/auth/session";
import { pluralize } from "@/lib/text";
import { listUsers } from "@/lib/users/userService";

export const metadata: Metadata = { title: "Admin" };

const joined = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

export default async function AdminPage() {
  const { user } = await requireAdmin();
  const users = await listUsers(actorFrom(user));
  const active = users.filter((entry) => entry.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${pluralize(users.length, "account")}, ${active} active. Open an account to see its tabs or manage access.`}
      />

      {/* Table from md up; a list on phones. */}
      <div className="hidden overflow-hidden rounded-[10px] border border-separator bg-raised md:block">
        <table className="w-full text-left text-[15px]">
          <caption className="sr-only">All user accounts</caption>
          <thead className="border-b border-separator bg-surface text-[13px] text-ink-secondary">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Tabs</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {users.map((entry) => (
              <tr key={entry.id} className="hover:bg-accent-soft/50">
                <td className="px-4 py-2">
                  <p className="font-medium">
                    {entry.name}
                    {entry.id === user.id && <span className="font-normal text-ink-secondary"> (you)</span>}
                  </p>
                  <p className="text-[13px] text-ink-secondary">{entry.email}</p>
                </td>
                <td className="px-4 py-2">
                  <RoleBadge role={entry.role} />
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={entry.status} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{entry.tabCount}</td>
                <td className="px-4 py-2 text-ink-secondary">{joined.format(new Date(entry.createdAt))}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/users/${entry.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-accent hover:bg-accent-soft"
                    aria-label={`Open ${entry.name}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="All user accounts" className="divide-y divide-separator overflow-hidden rounded-[10px] border border-separator bg-raised md:hidden">
        {users.map((entry) => (
          <li key={entry.id}>
            <Link href={`/admin/users/${entry.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-accent-soft">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {entry.name}
                  {entry.id === user.id && <span className="font-normal text-ink-secondary"> (you)</span>}
                </span>
                <span className="block truncate text-[13px] text-ink-secondary">
                  {entry.email}, {pluralize(entry.tabCount, "tab")}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <RoleBadge role={entry.role} />
                {entry.status === "disabled" && <StatusPill status={entry.status} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
