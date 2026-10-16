import type { Metadata } from "next";
import { AuthCard } from "@/app/login/auth-card";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่" };

// Reached from the reset email (signed in by the recovery link) or by a
// signed-in user who wants to change their password; the proxy sends
// everyone else to /login.
export default function ResetPasswordPage() {
  return (
    <AuthCard title="ตั้งรหัสผ่านใหม่" description="ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร">
      <ResetPasswordForm />
    </AuthCard>
  );
}
