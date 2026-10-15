"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toThaiError } from "@/lib/errors";

export interface AuthState {
  error?: string;
  message?: string;
  email?: string;
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "กรอกอีเมลและรหัสผ่าน", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: toThaiError(error), email };

  redirect("/dashboard");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "กรอกอีเมลและรหัสผ่าน", email };
  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", email };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: toThaiError(error), email };

  // Email confirmation disabled in Supabase → a session is returned immediately.
  if (data.session) redirect("/onboarding");

  return { message: `ส่งลิงก์ยืนยันไปที่ ${email} แล้ว เปิดอีเมลเพื่อยืนยันก่อนเข้าสู่ระบบ`, email };
}
