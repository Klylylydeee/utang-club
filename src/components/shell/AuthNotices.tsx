import "server-only";
import { getAuthEnv } from "@/lib/env";

/** Accounts need AUTH_SECRET (README → Accounts); without it, say so instead of failing later. */
export function authIsConfigured(): boolean {
  try {
    getAuthEnv();
    return true;
  } catch (error) {
    console.error("[auth]", error instanceof Error ? error.message : error);
    return false;
  }
}

export function SetupNotice() {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-separator bg-raised p-4 text-[15px]">
      <p className="font-medium">Accounts aren’t set up on this server yet.</p>
      <p className="text-ink-secondary">
        Add <code>AUTH_SECRET</code> to <code>.env.local</code> and restart the server. Then run{" "}
        <code className="font-mono">pnpm create-admin</code>. See README → Accounts.
      </p>
    </div>
  );
}
