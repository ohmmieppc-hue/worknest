"use client";

import { useActionState, useState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { respondAction, type RespondState } from "./actions";

export function RespondForm({ token }: { token: string }) {
  const [acceptState, accept, accepting] = useActionState<RespondState, FormData>(respondAction.bind(null, token, true), {});
  const [rejectState, reject, rejecting] = useActionState<RespondState, FormData>(respondAction.bind(null, token, false), {});
  const [mode, setMode] = useState<"accept" | "reject">("accept");
  const error = mode === "accept" ? acceptState.error : rejectState.error;
  const pending = accepting || rejecting;

  return (
    <form action={mode === "accept" ? accept : reject} className="space-y-4">
      <Field label="ชื่อผู้ตอบรับ" hint="ชื่อ-นามสกุล และตำแหน่ง (ถ้ามี)">
        <input name="name" required autoComplete="name" className={inputClass} placeholder="เช่น สมหญิง ใจดี (ผู้จัดการฝ่ายการตลาด)" />
      </Field>
      {mode === "accept" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree" required className="mt-0.5 size-4 accent-brand-600" />
          ได้อ่านรายการ ขอบเขตงาน และเงื่อนไขในใบเสนอราคานี้แล้ว และยืนยันการว่าจ้าง
        </label>
      )}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex flex-wrap items-center gap-3">
        {mode === "accept" ? (
          <>
            <Button type="submit" disabled={pending}>
              {accepting ? "กำลังบันทึก…" : "ตอบรับใบเสนอราคา"}
            </Button>
            <button type="button" onClick={() => setMode("reject")} className="text-sm text-stone-500 hover:text-stone-800 hover:underline">
              ไม่ตอบรับ
            </button>
          </>
        ) : (
          <>
            <Button type="submit" variant="danger" disabled={pending}>
              {rejecting ? "กำลังบันทึก…" : "ยืนยันไม่ตอบรับ"}
            </Button>
            <button type="button" onClick={() => setMode("accept")} className="text-sm text-stone-500 hover:text-stone-800 hover:underline">
              กลับไปตอบรับ
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-stone-500">ระบบจะบันทึกชื่อ วันเวลา และที่อยู่ IP ไว้เป็นหลักฐานการตอบรับ</p>
    </form>
  );
}
