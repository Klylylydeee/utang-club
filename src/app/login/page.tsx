import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirect";
import { getRequestContext } from "@/lib/auth/requestContext";
import { getSession } from "@/lib/auth/session";
import { getAuthEnv } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

function isConfigured(): boolean {
  try {
    getAuthEnv();
    return true;
  } catch (error) {
    console.error("[login]", error instanceof Error ? error.message : error);
    return false;
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);
  const configured = isConfigured();
  if (configured && (await getSession())) redirect(next);
  const { isHttps } = await getRequestContext();

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Utang Club</h1>
          <p className="text-ink-secondary">Sign in to see who owes whom.</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-separator bg-raised p-6 shadow-raised">
          {configured ? (
            <LoginForm next={next} />
          ) : (
            <div role="alert" className="space-y-2 text-sm">
              <p className="font-medium">Sign-in isn&apos;t set up yet.</p>
              <p className="text-ink-secondary">
                Run <code className="font-mono">pnpm hash-password</code>, add <code>AUTH_PASSWORD_HASH</code> and{" "}
                <code>AUTH_SECRET</code> to <code>.env.local</code>, then restart the server.
              </p>
            </div>
          )}
        </div>

        {!isHttps && (
          <p className="text-center text-sm text-ink-secondary" role="note">
            <span aria-hidden="true">⚠︎ </span>
            Not a secure connection. Only sign in on a network you trust.
          </p>
        )}
      </div>
    </div>
  );
}
