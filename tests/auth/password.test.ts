import { describe, expect, it } from "vitest";
import { burnPasswordCheck, hashPassword, PASSWORD_HASH_PATTERN, verifyPassword } from "@/lib/auth/password";

const PASSWORD = "correct horse battery";

describe("password hashing", () => {
  it("produces a colon-separated scrypt string with no '$' (safe in .env)", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).toMatch(PASSWORD_HASH_PATTERN);
    expect(hash.startsWith("scrypt:15:8:1:")).toBe(true);
    expect(hash).not.toContain("$");
  });

  it("salts every hash", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
    await expect(verifyPassword("correct horse batterY", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("rejects malformed or tampered hashes without throwing", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD, "")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, "plaintext")).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, hash.replace("scrypt:15", "scrypt:30"))).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, `${hash.slice(0, -2)}AA`)).resolves.toBe(false);
  });

  it("enforces password length limits when hashing", async () => {
    await expect(hashPassword("too short")).rejects.toThrow(RangeError);
    await expect(hashPassword("x".repeat(1025))).rejects.toThrow(RangeError);
  });

  it("refuses oversized input when verifying", async () => {
    const hash = await hashPassword(PASSWORD);
    await expect(verifyPassword("x".repeat(1025), hash)).resolves.toBe(false);
  });

  it("burnPasswordCheck spends scrypt work without throwing", async () => {
    await expect(burnPasswordCheck("anything")).resolves.toBeUndefined();
  });
});
