import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = { href: string; label: string };

/**
 * The header every page shares: breadcrumb, title, optional description or
 * meta line, and actions on the right (stacked below on phones).
 */
export function PageHeader(props: {
  title: ReactNode;
  breadcrumb?: Crumb[];
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  /** Off when section navigation sits right below and draws the rule. */
  bordered?: boolean;
}) {
  return (
    <header className={`space-y-3 pb-5 ${props.bordered === false ? "" : "border-b border-separator"}`}>
      {props.breadcrumb && props.breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="-my-2 flex flex-wrap items-center text-[13px] text-ink-secondary">
            {props.breadcrumb.map((crumb, index) => (
              <li key={crumb.href} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="px-1">
                    /
                  </span>
                )}
                <Link href={crumb.href} className="inline-flex min-h-11 items-center rounded px-1 hover:text-ink hover:underline">
                  {crumb.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight break-words">{props.title}</h1>
            {props.badge}
          </div>
          {props.description && <div className="max-w-[70ch] text-[15px] text-ink-secondary">{props.description}</div>}
        </div>
        {props.actions && <div className="flex shrink-0 flex-wrap gap-2">{props.actions}</div>}
      </div>
    </header>
  );
}
