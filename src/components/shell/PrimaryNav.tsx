"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Top-level areas on the navy bar. "Admin" appears only for administrators. */
export function PrimaryNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Tabs", active: pathname === "/" || pathname.startsWith("/tabs") },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }] : []),
  ];

  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`relative inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium transition-colors hover:bg-shell-hover ${
                item.active ? "text-shell-ink" : "text-shell-muted hover:text-shell-ink"
              }`}
            >
              {item.label}
              {item.active && (
                <span aria-hidden="true" className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-shell-ink" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
