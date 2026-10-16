"use client";

import { useActionState, useState } from "react";
import { Button, ErrorMessage, Field, inputClass } from "@/components/ui";
import { respondAction, type RespondState } from "./actions";

const COPY = {
  quotation: {
    name: "ชื่อผู้ตอบรับ",
    agree: "ได้อ่านรายการ ขอบเขตงาน และเงื่อนไขในใบเสนอราคานี้แล้ว และยืนยันการว่าจ้าง",
    accept: "ตอบรับใบเสนอราคา",
    toReject: "ไม่ตอบรับ",
    reject: "ยืนยันไม่ตอบรับ",
    back: "กลับไปตอบรับ",
    evidence: "ระบบจะบันทึกชื่อ วันเวลา และที่อยู่ IP ไว้เป็นหลักฐานการตอบรับ",
  },
  delivery_note: {
    name: "ชื่อผู้ตรวจรับ",
    agree: "ได้ตรวจสอบงานตามรายการข้างต้นแล้ว ถูกต้องครบถ้วน",
    accept: "ตรวจรับงาน",
    toReject: "ขอแก้ไขงาน",
    reject: "ส่งคำขอแก้ไข",
    back: "กลับไปตรวจรับ",
    evidence: "ระบบจะบันทึกชื่อ วันเวลา และที่อยู่ IP ไว้เป็นหลักฐานการตรวจรับ",
  },
};

export function RespondForm({ token, kind = "quotation" }: { token: string; kind?: keyof typeof COPY }) {
  const [acceptState, accept, accepting] = useActionState<RespondState, FormData>(respondAction.bind(null, token, true), {});
  const [rejectState, reject, rejecting] = useActionState<RespondState, FormData>(respondAction.bind(null, token, false), {});
  const [mode, setMode] = useState<"accept" | "reject">("accept");
  const error = mode === "accept" ? acceptState.error : rejectState.error;
  const pending = accepting || rejecting;
  const copy = COPY[kind];

  return (
    <form action={mode === "accept" ? accept : reject} className="space-y-4">
      <Field label={copy.name} hint="ชื่อ-นามสกุล และตำแหน่ง (ถ้ามี)">
        <input name="name" required autoComplete="name" className={inputClass} placeholder="เช่น สมหญิง ใจดี (ผู้จัดการฝ่ายการตลาด)" />
      </Field>
      {mode === "accept" ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree" required className="mt-0.5 size-4 accent-brand-600" />
          {copy.agree}
        </label>
      ) : (
        kind === "delivery_note" && (
          <Field label="สิ่งที่ต้องการให้แก้ไข">
            <textarea name="note" rows={4} required maxLength={1000} className={inputClass} placeholder="เช่น ขอเปลี่ยนสีพื้นหลังหน้าแรก และแก้คำผิดในหน้าติดต่อเรา" />
          </Field>
        )
      )}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex flex-wrap items-center gap-3">
        {mode === "accept" ? (
          <>
            <Button type="submit" disabled={pending}>
              {accepting ? "กำลังบันทึก…" : copy.accept}
            </Button>
            <button type="button" onClick={() => setMode("reject")} className="text-sm text-stone-500 hover:text-stone-800 hover:underline">
              {copy.toReject}
            </button>
          </>
        ) : (
          <>
            <Button type="submit" variant={kind === "delivery_note" ? "primary" : "danger"} disabled={pending}>
              {rejecting ? "กำลังบันทึก…" : copy.reject}
            </Button>
            <button type="button" onClick={() => setMode("accept")} className="text-sm text-stone-500 hover:text-stone-800 hover:underline">
              {copy.back}
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-stone-500">{copy.evidence}</p>
    </form>
  );
}
