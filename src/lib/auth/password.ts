/**
 * Owner-password hashing (decision D13). scrypt via node:crypto, compared
 * in constant time. Deliberately free of Next.js imports so
 * `scripts/hash-password.ts` can reuse it; it is still server-only in
 * practice because node:crypto cannot be bundled for the browser.
 *
 * Encoded format: scrypt:<log2 N>:<r>:<p>:<salt b64url>:<hash b64url>
 * (colons, not "$": Next.js expands "$NAME" inside .env values).
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 1024;

const DEFAULT_PARAMS = { log2N: 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export const PASSWORD_HASH_PATTERN = /^scrypt:\d{1,2}:\d{1,2}:\d{1,2}:[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{32,}$/;

function deriveKey(password: string, salt: Buffer, log2N: number, r: number, p: number): Promise<Buffer> {
  const N = 2 ** log2N;
  // scrypt needs 128 * N * r bytes; allow twice that so Node does not refuse.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string, params = DEFAULT_PARAMS): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new RangeError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new RangeError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, params.log2N, params.r, params.p);
  return ["scrypt", params.log2N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

/** Returns false for a wrong password or a malformed hash; never throws for bad input. */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!PASSWORD_HASH_PATTERN.test(encoded) || password.length > MAX_PASSWORD_LENGTH) return false;
  const [, log2N, r, p, saltText, keyText] = encoded.split(":");
  const params = [Number(log2N), Number(r), Number(p)] as const;
  if (params[0] < 10 || params[0] > 20 || params[1] < 1 || params[1] > 32 || params[2] < 1 || params[2] > 16) {
    return false;
  }
  const expected = Buffer.from(keyText, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await deriveKey(password, Buffer.from(saltText, "base64url"), ...params);
  return timingSafeEqual(actual, expected);
}

let decoyHash: Promise<string> | undefined;

/**
 * Spends the same scrypt work as a real check without comparing anything,
 * so a locked-out attempt takes as long as a normal failed one.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  decoyHash ??= hashPassword(randomBytes(24).toString("base64url"));
  await verifyPassword(password.slice(0, MAX_PASSWORD_LENGTH), await decoyHash);
}
