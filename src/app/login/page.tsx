import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            Work<span className="text-brand-600">Nest</span>
          </Link>
          <p className="mt-1 text-sm text-stone-500">ใบเสนอราคา ใบแจ้งหนี้ และลูกค้า ครบในที่เดียว</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
          <Suspense fallback={<LoginForm />}>
            <LoginBody searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
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
