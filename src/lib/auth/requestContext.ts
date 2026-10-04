import "server-only";
import { headers } from "next/headers";
import { clientAddressFrom, isHttpsRequest } from "./transport";

export type RequestContext = {
  /** Whether the browser reached us over HTTPS (directly or via a proxy). */
  isHttps: boolean;
  /** Best-effort client address for throttling; spoofable without a proxy. */
  clientAddress: string;
};

/**
 * Transport details of the current request. Cookie flags and HSTS follow
 * the real protocol, never NODE_ENV (decision D14).
 */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    isHttps: isHttpsRequest(h.get("x-forwarded-proto")),
    clientAddress: clientAddressFrom(h.get("x-forwarded-for"), h.get("x-real-ip")),
  };
}
