import Link from "next/link";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { BrandMark } from "@/components/shell/BrandMark";
import { PrimaryNav } from "@/components/shell/PrimaryNav";
import { requireSession } from "@/lib/auth/session";

/** Everything in this group requires a valid session (checked against the DB). */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();

  return (
    <>
      <header className="sticky top-0 z-10 bg-shell pt-[env(safe-area-inset-top)] text-shell-ink">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-[max(1rem,env(safe-area-inset-left))]">
          <Link href="/" aria-label="Utang Club home" className="-ml-2 inline-flex min-h-11 items-center gap-2.5 rounded-lg px-2 hover:bg-shell-hover">
            <BrandMark className="size-7" />
            <span className="hidden text-[16px] font-semibold tracking-tight sm:inline">Utang Club</span>
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-shell-hover" />
          <PrimaryNav isAdmin={user.role === "admin"} />
          <div className="ml-auto">
            <AccountMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-8">
        {children}
      </main>
    </>
  );
}
