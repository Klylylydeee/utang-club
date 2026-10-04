/**
 * Shared by the proxy and the session code. Over HTTPS the cookie uses the
 * `__Host-` prefix (requires Secure, Path=/, no Domain). Over plain-HTTP LAN
 * a Secure cookie would be dropped by the browser, so a plain name is used
 * instead (decision D14).
 */
export const SESSION_COOKIE_SECURE = "__Host-uc_session";
export const SESSION_COOKIE_PLAIN = "uc_session";

export const SESSION_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;
/** How stale lastSeenAt may get before an access refreshes it (limits writes). */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
/** Pages reachable without a session. */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set([LOGIN_PATH, REGISTER_PATH]);

/**
 * File downloads (share image, CSV). Without a session they answer 404 from
 * the route itself instead of being redirected to the sign-in page, which a
 * script fetching an image can't use.
 */
export const EXPORT_PATH_PATTERN = /^\/tabs\/[^/]+\/settlements\/(?:image|csv)$/;

export function sessionCookieName(isHttps: boolean): string {
  return isHttps ? SESSION_COOKIE_SECURE : SESSION_COOKIE_PLAIN;
}
