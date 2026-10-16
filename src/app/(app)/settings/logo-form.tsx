"use client";

import { useActionState, useState } from "react";
import { ErrorMessage, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { removeLogoAction, uploadLogoAction, type LogoState } from "./actions";

export function LogoForm({ logoUrl }: { logoUrl: string | null }) {
  const [state, action] = useActionState<LogoState, FormData>(uploadLogoAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? logoUrl;

  return (
    <section className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="font-semibold">โลโก้</h2>
        <p className="mt-1 text-sm text-stone-500">PNG หรือ JPG ไม่เกิน 1MB แสดงบนเอกสารที่ออกใหม่</p>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 p-2">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- public storage URL, no optimisation needed
            <img src={shown} alt="โลโก้" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-stone-400">ยังไม่มีโลโก้</span>
          )}
        </div>
        <div className="space-y-3">
          <form action={action} className="flex flex-wrap items-center gap-2">
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              required
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
            />
            <SubmitButton pendingText="กำลังอัปโหลด…">อัปโหลด</SubmitButton>
          </form>
          {logoUrl && !preview && (
            <form action={removeLogoAction}>
              <button type="submit" className={buttonClass("ghost")}>
                เอาโลโก้ออก
              </button>
            </form>
          )}
          <ErrorMessage>{state.error}</ErrorMessage>
          {state.saved && !state.error && <p className="text-sm text-brand-700">บันทึกโลโก้แล้ว</p>}
        </div>
      </div>
    </section>
  );
}
