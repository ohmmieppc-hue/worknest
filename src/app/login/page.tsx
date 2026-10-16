import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard>
      <Suspense fallback={<LoginForm />}>
        <LoginBody searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginBody({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");

  const { error, mode } = await searchParams;
  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่
        </p>
      )}
      <LoginForm initialMode={mode === "signup" ? "signup" : "signin"} />
    </>
  );
}
