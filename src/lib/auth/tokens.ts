import { createHash, createHmac, randomBytes } from "node:crypto";

/** A new opaque session token for the cookie (256 bits of randomness). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a database leak does not leak live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Identifies the current owner password without storing it. Sessions carry
 * this; changing AUTH_PASSWORD_HASH therefore invalidates every session.
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 32);
}

/** Keyed hash of a client address, so raw IPs are never stored. */
export function hashClientKey(clientAddress: string, secret: string): string {
  return createHmac("sha256", secret).update(`client:${clientAddress}`).digest("hex");
}
