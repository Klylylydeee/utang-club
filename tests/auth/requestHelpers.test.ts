import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";
import { clientAddressFrom, isHttpsRequest } from "@/lib/auth/transport";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

describe("safeNextPath (open-redirect protection)", () => {
  it.each(["/", "/tabs/abc", "/tabs/abc/settlements?x=1"])("allows %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\u0009/evil.example",
    "/login",
    "/login?next=/x",
    "",
    "x".repeat(600),
  ])("rejects %j", (path) => {
    expect(safeNextPath(path)).toBe("/");
  });

  it("rejects non-strings", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("transport detection", () => {
  it("detects HTTPS from the proxy header or the URL", () => {
    expect(isHttpsRequest("https")).toBe(true);
    expect(isHttpsRequest("https, http")).toBe(true);
    expect(isHttpsRequest("http", "https:")).toBe(false);
    expect(isHttpsRequest(null, "https:")).toBe(true);
    expect(isHttpsRequest(null, "http:")).toBe(false);
  });

  it("takes the first forwarded client address", () => {
    expect(clientAddressFrom("203.0.113.5, 10.0.0.1", null)).toBe("203.0.113.5");
    expect(clientAddressFrom(null, "192.168.1.20")).toBe("192.168.1.20");
    expect(clientAddressFrom(null, null)).toBe("unknown");
  });
});

describe("Content-Security-Policy", () => {
  it("is strict in production over HTTPS", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", isDev: false, isHttps: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("never upgrades requests over plain HTTP (LAN access, D14)", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", isDev: false, isHttps: false });
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows eval and websockets only in dev", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", isDev: true, isHttps: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
  });

  it("does not put a nonce in style-src (it would disable 'unsafe-inline')", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", isDev: false, isHttps: true });
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});
