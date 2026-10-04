import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Utang Club", template: "%s · Utang Club" },
  description: "Split the bill on trips, nights out and dinners, and settle up clearly.",
};

// Never disable zoom; `viewport-fit=cover` enables safe-area insets.
// `resizes-content`: on Android the layout shrinks when the keyboard opens,
// so sheets and sticky buttons stay above it (iOS is handled in Sheet).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // Matches the navy app bar (D18).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f1a3c" },
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so Next.js can apply the CSP nonce
  // from proxy.ts to its scripts (static pages would have none).
  await connection();

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
