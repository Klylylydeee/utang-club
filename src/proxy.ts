import { NextResponse, type NextRequest } from "next/server";
import { EXPORT_PATH_PATTERN, LOGIN_PATH, PUBLIC_PATHS, SESSION_COOKIE_PLAIN, SESSION_COOKIE_SECURE } from "@/lib/auth/constants";
import { isHttpsRequest } from "@/lib/auth/transport";
import { buildContentSecurityPolicy, HSTS_VALUE } from "@/lib/security/csp";

/**
 * Runs before every page request. Two jobs only:
 *   1. per-request CSP nonce and transport-dependent headers;
 *   2. a fast redirect to /login when there is no session cookie at all.
 *
 * This is NOT the security boundary: requireSession()/authedAction()
 * validate the session against the database on every page and action.
 */
export function proxy(request: NextRequest) {
  const isHttps = isHttpsRequest(request.headers.get("x-forwarded-proto"), request.nextUrl.protocol);
  const { pathname, search } = request.nextUrl;

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_SECURE) || request.cookies.has(SESSION_COOKIE_PLAIN);
  // Only redirect page navigations; Server Action POSTs get a structured
  // "unauthenticated" result from authedAction instead.
  if (
    !hasSessionCookie &&
    !PUBLIC_PATHS.has(pathname) &&
    !EXPORT_PATH_PATTERN.test(pathname) &&
    request.method === "GET"
  ) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return withTransportHeaders(NextResponse.redirect(loginUrl), isHttps);
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = buildContentSecurityPolicy({ nonce, isDev: process.env.NODE_ENV === "development", isHttps });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // Authenticated pages must never be cached by browsers or proxies.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return withTransportHeaders(response, isHttps);
}

function withTransportHeaders(response: NextResponse, isHttps: boolean): NextResponse {
  if (isHttps) response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
