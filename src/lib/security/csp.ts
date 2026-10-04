/**
 * Content-Security-Policy per request (PHASING.md → Phase 3, UI_SPEC.md →
 * Mobile and external-device access).
 *
 * - Scripts: only nonce-bearing ones (Next.js adds the nonce to its own).
 * - Styles: 'unsafe-inline' (React style attributes); a nonce is omitted
 *   on purpose because it would make browsers ignore 'unsafe-inline'.
 * - Dev adds 'unsafe-eval' (React debugging) and ws:/wss: (hot reload).
 * - upgrade-insecure-requests only over HTTPS: on plain-HTTP LAN it would
 *   upgrade every asset to HTTPS and nothing would load on the phone.
 */
export function buildContentSecurityPolicy(options: { nonce: string; isDev: boolean; isHttps: boolean }): string {
  const { nonce, isDev, isHttps } = options;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isHttps) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export const HSTS_VALUE = "max-age=63072000; includeSubDomains";
