import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserAdminControls } from "@/components/admin/UserAdminControls";
import { RoleBadge, StatusPill } from "@/components/admin/UserBadges";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabList } from "@/components/tabs/TabCard";
import { cardStyles } from "@/components/ui/styles";
import { actorFrom } from "@/lib/auth/actor";
import { requireAdmin } from "@/lib/auth/session";
import { listTabsForUser } from "@/lib/tabs/tabService";
import { getUserSummary } from "@/lib/users/userService";
import { objectIdSchema } from "@/schemas/common";

export const metadata: Metadata = { title: "User" };

const joined = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" });

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  const { user: me } = await requireAdmin();
  const parsed = objectIdSchema.safeParse((await params).userId);
  if (!parsed.success) notFound();
  const actor = actorFrom(me);
  const user = await getUserSummary(parsed.data, actor);
  if (!user) notFound();
  const tabs = await listTabsForUser(user.id, actor);
  const isMe = user.id === me.id;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ href: "/admin", label: "Admin" }]}
        title={user.name}
        badge={
          <span className="flex items-center gap-3">
            <RoleBadge role={user.role} />
            <StatusPill status={user.status} />
          </span>
        }
        description={`${user.email}. Joined ${joined.format(new Date(user.createdAt))}.`}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="user-tabs" className="space-y-3">
          <h2 id="user-tabs" className="text-[15px] font-semibold text-ink-secondary">
            Tabs ({tabs.length})
          </h2>
          {tabs.length === 0 ? (
            <p className={`${cardStyles} px-5 py-8 text-center text-ink-secondary`}>No tabs yet.</p>
          ) : (
            <TabList tabs={tabs} label={`${user.name}'s tabs`} />
          )}
          {tabs.length > 0 && !isMe && (
            <p className="text-[13px] text-ink-secondary">You can open these tabs to view them. Only {user.name} can change them.</p>
          )}
        </section>

        <section aria-labelledby="user-access" className={`${cardStyles} space-y-4 p-5`}>
          <h2 id="user-access" className="text-[17px] font-semibold">
            Access
          </h2>
          {isMe ? (
            <p className="text-[15px] text-ink-secondary">
              This is your account. Another administrator has to change your role, status or password.
            </p>
          ) : (
            <UserAdminControls user={user} />
          )}
        </section>
      </div>
    </div>
  );
}
