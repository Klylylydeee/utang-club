import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { NewTabForm } from "@/components/tabs/NewTabForm";
import { cardStyles } from "@/components/ui/styles";

export const metadata: Metadata = { title: "New tab" };

export default function NewTabPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ href: "/", label: "Tabs" }]}
        title="New tab"
        description="Name it after the activity, like a trip, a night out or a dinner, so everyone knows what it’s for."
      />
      <div className={`${cardStyles} max-w-xl p-6`}>
        <NewTabForm />
      </div>
    </div>
  );
}
