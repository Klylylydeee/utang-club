import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard rail (PHASING.md → Phase 3): every Server Action must be created
 * with authedAction(), so forgetting the session check fails the build's
 * tests instead of shipping an open endpoint. Only login is exempt.
 */
const ALLOWED_UNAUTHENTICATED = new Set(["src/app/login/actions.ts#login"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const root = process.cwd();
const serverActionFiles = sourceFiles(join(root, "src")).filter((file) =>
  /^\s*["']use server["'];?/m.test(readFileSync(file, "utf8")),
);

describe("Server Actions", () => {
  it("finds the action modules", () => {
    expect(serverActionFiles.length).toBeGreaterThan(0);
  });

  it.each(serverActionFiles.map((file) => [relative(root, file).split(sep).join("/"), file]))(
    "%s exports only authedAction()-wrapped actions",
    (relativePath, file) => {
      const source = readFileSync(file, "utf8");
      const violations: string[] = [];

      for (const match of source.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g)) {
        if (!ALLOWED_UNAUTHENTICATED.has(`${relativePath}#${match[1]}`)) violations.push(match[1]);
      }
      for (const match of source.matchAll(/export\s+const\s+(\w+)\s*=\s*([\w.]+)/g)) {
        if (match[2] !== "authedAction") violations.push(match[1]);
      }
      // Inline "use server" inside functions would bypass this check entirely.
      const inline = source.match(/["']use server["']/g)?.length ?? 0;
      if (inline > 1) violations.push("(inline 'use server')");

      expect(violations, `Unauthenticated Server Actions in ${relativePath}`).toEqual([]);
    },
  );

  it("does not allow inline 'use server' in other files", () => {
    const inlineUsers = sourceFiles(join(root, "src")).filter((file) => {
      const source = readFileSync(file, "utf8");
      return !serverActionFiles.includes(file) && /["']use server["']/.test(source);
    });
    expect(inlineUsers).toEqual([]);
  });
});
