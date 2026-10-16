"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState(initialMode);
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-stone-100 p-1 text-sm font-medium">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 transition ${mode === m ? "bg-white shadow-xs" : "text-stone-500"}`}
          >
            {m === "signin" ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}
          </button>
        ))}
      </div>

      <form action={mode === "signin" ? signInAction : signUpAction} className="space-y-4">
        <Field label="อีเมล">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email}
            className={inputClass}
          />
        </Field>
        {mode === "signin" && (
          <Link href="/forgot-password" className="float-right text-sm text-stone-500 hover:text-brand-700 hover:underline">
            ลืมรหัสผ่าน?
          </Link>
        )}
        <Field label="รหัสผ่าน" hint={mode === "signup" ? "อย่างน้อย 8 ตัวอักษร" : undefined}>
          <PasswordInput
            name="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </Field>

        <ErrorMessage>{state.error}</ErrorMessage>
        {state.message && (
          <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
        </Button>
      </form>
    </div>
  );
}
