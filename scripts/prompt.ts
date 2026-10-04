// Terminal prompts for the setup scripts. Hidden input never echoes the password.
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export function readHidden(prompt: string): Promise<string> {
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
