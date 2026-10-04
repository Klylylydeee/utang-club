"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Underline navigation between a tab's sections. Called "sections" on
 * purpose: "tab" always means a tab of expenses (UI_SPEC.md).
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
    <nav aria-label="Tab sections" className="-mt-px overflow-x-auto border-b border-separator">
      <ul className="flex gap-1">
        {sections.map((section) => {
          const current = pathname === section.href;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={`relative flex min-h-11 items-center px-3 text-[15px] font-medium whitespace-nowrap transition-colors ${
                  current ? "text-ink" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {section.label}
                {current && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
