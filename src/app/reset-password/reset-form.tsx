"use client";

import { useActionState } from "react";
import { Button, ErrorMessage, Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { updatePassword, type AuthState } from "@/app/login/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร">
        <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="ยืนยันรหัสผ่านใหม่">
        <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" />
      </Field>
      <ErrorMessage>{state.error}</ErrorMessage>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}
