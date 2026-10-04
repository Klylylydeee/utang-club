"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Segmented control between a tab's sections. Called "sections" on purpose:
 * "tab" always means a tab of expenses (UI_SPEC.md).
 */
export function SectionNav({ tabId }: { tabId: string }) {
  const pathname = usePathname();
  const base = `/tabs/${tabId}`;
  const sections = [
    { href: base, label: "Overview" },
    { href: `${base}/transactions`, label: "Transactions" },
    { href: `${base}/settlements`, label: "Settlements" },
  ];

  return (
    <nav aria-label="Tab sections" className="overflow-x-auto">
      <ul className="inline-flex min-w-full gap-1 rounded-xl bg-separator/50 p-1 sm:min-w-0">
        {sections.map((section) => {
          const current = pathname === section.href;
          return (
            <li key={section.href} className="flex-1 sm:flex-none">
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-lg px-4 text-[15px] font-medium whitespace-nowrap transition-colors ${
                  current ? "bg-raised text-ink shadow-raised" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
