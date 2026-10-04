import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { authIsConfigured, SetupNotice } from "@/components/shell/AuthNotices";
import { LOGIN_PATH } from "@/lib/auth/constants";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage() {
  const configured = authIsConfigured();
  if (configured && (await getSession())) redirect("/");

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start a tab for your next trip, night out or dinner. It takes a minute."
      footer={
        <>
          <p className="text-[15px] text-ink-secondary">
            Already have an account?{" "}
            <Link href={LOGIN_PATH} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      {configured ? <RegisterForm /> : <SetupNotice />}
    </AuthLayout>
  );
}
