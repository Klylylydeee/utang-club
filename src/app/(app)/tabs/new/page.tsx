import type { Metadata } from "next";
import Link from "next/link";
import { NewTabForm } from "@/components/tabs/NewTabForm";
import { cardStyles } from "@/components/ui/styles";
import { defaultTabName } from "@/lib/tabs/defaultTabName";

export const metadata: Metadata = { title: "New tab" };

export default function NewTabPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/" className="inline-flex min-h-11 items-center text-ink-secondary hover:text-ink">
        <span aria-hidden="true">‹&nbsp;</span>Your tabs
      </Link>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">New tab</h1>
        <p className="text-ink-secondary">Name it after the month, or anything that marks this stretch of expenses.</p>
      </div>
      <div className={`${cardStyles} p-6`}>
        <NewTabForm defaultName={defaultTabName()} />
      </div>
    </div>
  );
}
