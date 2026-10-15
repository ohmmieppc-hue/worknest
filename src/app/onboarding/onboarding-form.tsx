"use client";

import { useActionState } from "react";
import { ErrorMessage, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createWorkspaceAction, type OnboardingState } from "./actions";

export function OnboardingForm({ email }: { email: string }) {
  const [state, action] = useActionState<OnboardingState, FormData>(createWorkspaceAction, {});

  return (
    <form action={action} className="space-y-4">
      <Field label="ชื่อบนเอกสาร *" hint="ชื่อ-นามสกุล หรือชื่อธุรกิจตามที่ต้องการให้ลูกค้าเห็น">
        <input name="legal_name" required className={inputClass} placeholder="เช่น นายสมชาย ใจดี" />
      </Field>
      <Field label="ชื่อแบรนด์ / สตูดิโอ" hint="ไม่บังคับ ใช้แสดงในระบบ">
        <input name="display_name" className={inputClass} placeholder="เช่น Somchai Studio" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="เลขประจำตัวผู้เสียภาษี" hint="13 หลัก (เลขบัตรประชาชน)">
          <input name="tax_id" inputMode="numeric" maxLength={17} className={inputClass} />
        </Field>
        <Field label="พร้อมเพย์" hint="เบอร์โทรหรือเลข 13 หลัก">
          <input name="promptpay_id" inputMode="numeric" maxLength={17} className={inputClass} />
        </Field>
        <Field label="โทรศัพท์">
          <input name="phone" type="tel" className={inputClass} />
        </Field>
        <Field label="อีเมลติดต่อ">
          <input name="email" type="email" defaultValue={email} className={inputClass} />
        </Field>
      </div>
      <Field label="ที่อยู่">
        <textarea name="address" rows={3} className={inputClass} />
      </Field>

      <ErrorMessage>{state.error}</ErrorMessage>
      <SubmitButton className="w-full" pendingText="กำลังสร้าง…">
        เริ่มใช้งาน
      </SubmitButton>
      <p className="text-center text-xs text-stone-500">แก้ไขข้อมูลเหล่านี้ภายหลังได้ในหน้าตั้งค่า</p>
    </form>
  );
}
