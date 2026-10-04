import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { authIsConfigured, InsecureNotice, SetupNotice } from "@/components/shell/AuthNotices";
import { REGISTER_PATH } from "@/lib/auth/constants";
import { safeNextPath } from "@/lib/auth/redirect";
import { getRequestContext } from "@/lib/auth/requestContext";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);
  const configured = authIsConfigured();
  if (configured && (await getSession())) redirect(next);
  const { isHttps } = await getRequestContext();

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where your group left off."
      footer={
        <>
          <p className="text-[15px] text-ink-secondary">
            New to Utang Club?{" "}
            <Link href={REGISTER_PATH} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
              Create an account
            </Link>
          </p>
          {!isHttps && <InsecureNotice />}
        </>
      }
    >
      {configured ? <LoginForm next={next} /> : <SetupNotice />}
    </AuthLayout>
  );
}
