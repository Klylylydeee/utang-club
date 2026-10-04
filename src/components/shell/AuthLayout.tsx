import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

const PROMISES = [
  { title: "Every balance has receipts", body: "Open any settlement to see the exact rows behind it." },
  { title: "Private unless you share", body: "Your tabs are yours. Share one with a friend to view or edit together." },
  { title: "Exact to the centavo", body: "Reciprocal debts are netted pair by pair, with no rounding drift." },
];

/**
 * Sign-in and registration (D18): a navy brand panel beside the form on
 * wide screens, stacked with a compact brand bar on phones.
 */
export function AuthLayout(props: { title: string; subtitle: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-shell px-12 py-10 text-shell-ink lg:flex">
        {/* Decorative ledger lines; pointer-events off so nothing can block a tap. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_39px,white_39px,white_40px)]"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-9" />
          <span className="text-lg font-semibold tracking-tight">Utang Club</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <p className="text-[34px] leading-tight font-semibold tracking-tight">
              Shared expenses, settled clearly.
            </p>
            <p className="text-[17px] text-shell-muted">
              Record what everyone spent on trips, nights out and dinners. Utang Club works out who pays whom.
            </p>
          </div>
          <ul className="space-y-5">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex gap-3">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                </svg>
                <div>
                  <p className="font-medium">{promise.title}</p>
                  <p className="text-[15px] text-shell-muted">{promise.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[13px] text-shell-muted">Built for barkadas, families and anyone who splits the bill.</p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center gap-2.5 bg-shell px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-shell-ink lg:hidden">
          <BrandMark className="size-7" />
          <span className="font-semibold tracking-tight">Utang Club</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[400px] space-y-7">
            <div className="space-y-1.5">
              <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{props.title}</h1>
              <p className="text-[15px] text-ink-secondary">{props.subtitle}</p>
            </div>
            {props.children}
            {props.footer}
          </div>
        </div>
        <p className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[13px] text-ink-secondary">
          Created by cly_gvr32
        </p>
      </main>
    </div>
  );
}
