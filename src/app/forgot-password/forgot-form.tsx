"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { requestPasswordReset, type AuthState } from "@/app/login/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  if (state.message) {
    return <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">{state.message}</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="อีเมล">
        <input name="email" type="email" required autoComplete="email" defaultValue={state.email} className={inputClass} />
      </Field>
      <ErrorMessage>{state.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}
