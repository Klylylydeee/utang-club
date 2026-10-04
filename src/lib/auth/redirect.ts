import { LOGIN_PATH } from "./constants";

/**
 * Where to go after logging in. Only same-site relative paths are allowed,
 * so `?next=` can never be used as an open redirect.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length > 512) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  // Reject control characters, which some browsers strip to form "//host".
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`) || next.startsWith(`${LOGIN_PATH}/`)) return "/";
  return next;
}
