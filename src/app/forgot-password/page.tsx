import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/app/login/auth-card";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="ลืมรหัสผ่าน" description="กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้">
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-stone-500 hover:text-stone-800 hover:underline">
          ← กลับไปเข้าสู่ระบบ
        </Link>
      </p>
    </AuthCard>
  );
}
