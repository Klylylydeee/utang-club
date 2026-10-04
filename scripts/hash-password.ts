// Generates AUTH_PASSWORD_HASH for .env.local: `pnpm hash-password`.
// The password is read without echo and never written anywhere.
// Runs with Node's built-in TypeScript support (Node 22.18+ / 24).
import { randomBytes } from "node:crypto";
import { stdin, stdout, stderr } from "node:process";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password.ts";

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error("Run this in an interactive terminal so the password is not echoed."));
      return;
    }
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stderr.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stderr.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await readHidden(`Owner password (min ${MIN_PASSWORD_LENGTH} characters): `);
if (password.length < MIN_PASSWORD_LENGTH) {
  stderr.write(`Too short: use at least ${MIN_PASSWORD_LENGTH} characters.\n`);
  process.exit(1);
}
const confirmation = await readHidden("Confirm password: ");
if (confirmation !== password) {
  stderr.write("Passwords do not match.\n");
  process.exit(1);
}

const hash = await hashPassword(password);
stdout.write("\nAdd to .env.local (changing it signs out every device):\n\n");
stdout.write(`AUTH_PASSWORD_HASH=${hash}\n`);
stdout.write("\nIf you don't have an AUTH_SECRET yet, use this one:\n\n");
stdout.write(`AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`);
