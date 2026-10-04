/** Pure request-transport helpers, shared by the proxy and server code. */

/** HTTPS directly or behind a proxy that sets x-forwarded-proto. */
export function isHttpsRequest(forwardedProto: string | null, urlProtocol?: string): boolean {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "https" || (!proto && urlProtocol === "https:");
}

/** Best-effort client address for throttling (spoofable without a proxy). */
export function clientAddressFrom(forwardedFor: string | null, realIp: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return (first || realIp?.trim() || "unknown").slice(0, 64);
}
