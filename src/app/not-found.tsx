import type { Metadata } from "next";
import { NotFoundCard } from "@/components/shell/NotFoundCard";

export const metadata: Metadata = { title: "Not found" };

/** URLs that match no route. */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <NotFoundCard />
    </main>
  );
}
