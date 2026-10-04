import { networkInterfaces } from "node:os";
import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./e2e/constants.ts";

/**
 * Touch and device suite (TESTING.md → External-device and touch tests).
 * It runs against this machine's LAN IP, not localhost, so problems with
 * allowedDevOrigins, the CSP or cookies over plain HTTP show up here as
 * they would on a phone.
 *
 *   pnpm e2e              production build (next build && next start)
 *   pnpm e2e:dev          dev server
 *
 * e2e/serve.mjs starts a throwaway database for each run.
 */
function lanAddress(): string {
  const address = Object.values(networkInterfaces())
    .flat()
    .find((iface) => iface?.family === "IPv4" && !iface.internal)?.address;
  return process.env.E2E_HOST ?? address ?? "127.0.0.1";
}

// Windows on ARM: Edge is native; Playwright's bundled Chromium is x64 only.
const chromiumChannel =
  process.env.E2E_CHROMIUM_CHANNEL ?? (process.platform === "win32" && process.arch === "arm64" ? "msedge" : undefined);

const baseURL = `http://${lanAddress()}:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Each project shares one server and database; flows create their own tabs.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "pixel", use: { ...devices["Pixel 7"], channel: chromiumChannel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, channel: chromiumChannel } },
  ],
  webServer: {
    command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/serve.mjs",
    url: `${baseURL}/login`,
    // A production build plus a first MongoDB download can take a while.
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
