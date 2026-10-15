import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/workspace";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "ตั้งค่าเริ่มต้น" };

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">ยินดีต้อนรับสู่ WorkNest</h1>
          <p className="mt-1 text-sm text-stone-500">
            กรอกข้อมูลผู้ให้บริการ ข้อมูลนี้จะแสดงบนใบเสนอราคาและใบแจ้งหนี้ของคุณ
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-stone-50" />}>
            <Onboarding />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Onboarding() {
  const { user, workspace } = await getSession();
  if (workspace) redirect("/dashboard");
  return <OnboardingForm email={user.email ?? ""} />;
}
