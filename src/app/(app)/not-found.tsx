import type { Metadata } from "next";
import { NotFoundCard } from "@/components/shell/NotFoundCard";

export const metadata: Metadata = { title: "Not found" };

/** notFound() inside the signed-in area: keeps the app bar. */
export default function AppNotFound() {
  return (
    <div className="py-10">
      <NotFoundCard />
    </div>
  );
}
