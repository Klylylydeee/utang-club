import Link from "next/link";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { requireSession } from "@/lib/auth/session";

/** Everything in this group requires a valid session (checked against the DB). */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSession();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-separator bg-translucent pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-[max(1rem,env(safe-area-inset-left))]">
          <Link
            href="/"
            className="-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-[17px] font-semibold tracking-tight"
          >
            Utang Club
          </Link>
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-12">
        {children}
      </main>
    </>
  );
}
