import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown under the tab's header while a section (overview, transactions,
 * settlements) loads. Only here: the tab layout has already checked access
 * outside this boundary, so a tab you may not see still answers HTTP 404.
 * A loading.tsx higher up would start streaming first and turn that into 200.
 */
export default function TabSectionLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="hidden h-36 lg:block" />
      </div>
    </div>
  );
}
