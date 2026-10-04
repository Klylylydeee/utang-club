import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/** Splits a comma-separated env var into trimmed, non-empty entries. */
function listFromEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * IPv4 addresses of this machine's network interfaces, so phones on the
 * same Wi-Fi can load dev assets (see UI_SPEC.md → Mobile and
 * external-device access). Only used by `next dev`.
 */
function lanHostnames(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface !== undefined && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);
}

// Protocol-independent headers only. CSP (nonce-based) and HSTS depend on
// the request and are set per request in Phase 3.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // The Playwright suite builds into its own folder (e2e/serve.mjs), so it
  // never disturbs a running `pnpm dev` or the normal build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  allowedDevOrigins: [...lanHostnames(), ...listFromEnv(process.env.DEV_ALLOWED_ORIGINS)],
  experimental: {
    serverActions: {
      // Empty by default: same-origin only. Add tunnel/proxy hosts via env.
      allowedOrigins: listFromEnv(process.env.ACTION_ALLOWED_ORIGINS),
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
