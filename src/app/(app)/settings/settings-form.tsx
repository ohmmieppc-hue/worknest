"use client";

import { useActionState } from "react";
import { ErrorMessage, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { Workspace } from "@/lib/types";
import { updateWorkspaceAction, type SettingsState } from "./actions";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-stone-200 py-6 first:pt-0 last:border-0 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ workspace }: { workspace: Workspace }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateWorkspaceAction, {});
  const bank = workspace.bank_accounts[0];

  return (
    <form action={action}>
      <Section title="ข้อมูลผู้ให้บริการ" description="แสดงบนเอกสารที่ออกใหม่ เอกสารที่ออกไปแล้วจะไม่เปลี่ยน">
        <Field label="ชื่อบนเอกสาร *" className="sm:col-span-2">
          <input name="legal_name" required defaultValue={workspace.legal_name} className={inputClass} />
        </Field>
        <Field label="ชื่อแบรนด์ / สตูดิโอ" hint="ใช้แสดงในระบบ">
          <input name="display_name" defaultValue={workspace.display_name} className={inputClass} />
        </Field>
        <div className="hidden sm:block" />
        <Field label="เลขประจำตัวผู้เสียภาษี" hint="13 หลัก">
          <input name="tax_id" inputMode="numeric" maxLength={17} defaultValue={workspace.tax_id ?? ""} className={inputClass} />
        </Field>
        <Field label="สาขา" hint="สำนักงานใหญ่ = 00000">
          <input name="branch_code" inputMode="numeric" maxLength={5} defaultValue={workspace.branch_code} className={inputClass} />
        </Field>
        <Field label="โทรศัพท์">
          <input name="phone" type="tel" defaultValue={workspace.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="อีเมลติดต่อ">
          <input name="email" type="email" defaultValue={workspace.email ?? ""} className={inputClass} />
        </Field>
        <Field label="ที่อยู่" className="sm:col-span-2">
          <textarea name="address" rows={3} defaultValue={workspace.address ?? ""} className={inputClass} />
        </Field>
      </Section>

      <Section
        title="ภาษีมูลค่าเพิ่ม (VAT)"
        description="เปิดเมื่อจดทะเบียน VAT แล้วเท่านั้น (รายได้เกิน 1.8 ล้านบาทต่อปีต้องจด)"
      >
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="vat_registered"
            defaultChecked={workspace.vat_registered}
            className="mt-0.5 size-4 shrink-0 accent-brand-600"
          />
          <span>
            <span className="font-medium">จดทะเบียนภาษีมูลค่าเพิ่มแล้ว</span>
            <span className="mt-0.5 block text-stone-500">
              ใบเสนอราคาและใบแจ้งหนี้ใหม่จะคิด VAT 7% (ปิดได้รายใบ) และใบเสร็จของใบแจ้งหนี้ที่มี VAT จะออกเป็น
              “ใบเสร็จรับเงิน/ใบกำกับภาษี” เมื่อรับเงิน ต้องกรอกเลขประจำตัวผู้เสียภาษีด้านบน
            </span>
          </span>
        </label>
      </Section>

      <Section title="การรับเงิน" description="พร้อมเพย์ใช้สร้าง QR บนใบแจ้งหนี้ บัญชีธนาคารแสดงเป็นทางเลือกให้ลูกค้าโอน">
        <Field label="พร้อมเพย์" hint="เบอร์โทร 10 หลัก หรือเลข 13 หลัก" className="sm:col-span-2">
          <input name="promptpay_id" inputMode="numeric" maxLength={17} defaultValue={workspace.promptpay_id ?? ""} className={inputClass} />
        </Field>
        <Field label="ธนาคาร">
          <input name="bank_name" defaultValue={bank?.bank ?? ""} placeholder="เช่น กสิกรไทย" className={inputClass} />
        </Field>
        <Field label="เลขที่บัญชี">
          <input name="bank_account_no" defaultValue={bank?.account_no ?? ""} className={inputClass} />
        </Field>
        <Field label="ชื่อบัญชี" className="sm:col-span-2">
          <input name="bank_account_name" defaultValue={bank?.account_name ?? ""} className={inputClass} />
        </Field>
      </Section>

      <Section title="ค่าเริ่มต้นของเอกสาร">
        <Field label="ระยะยืนราคา (วัน)" hint="ใช้กับใบเสนอราคาใหม่">
          <input
            name="default_quote_valid_days"
            type="number"
            min={1}
            step={1}
            defaultValue={workspace.default_quote_valid_days}
            className={inputClass}
          />
        </Field>
        <Field label="เครดิตเทอม (วัน)" hint="ใช้คำนวณวันครบกำหนดของใบแจ้งหนี้ใหม่">
          <input
            name="default_credit_days"
            type="number"
            min={0}
            step={1}
            defaultValue={workspace.default_credit_days}
            className={inputClass}
          />
        </Field>
      </Section>

      <div className="space-y-3 pt-2">
        <ErrorMessage>{state.error}</ErrorMessage>
        <div className="flex items-center gap-3">
          <SubmitButton>บันทึกการตั้งค่า</SubmitButton>
          {state.saved && <span className="text-sm text-brand-700">บันทึกแล้ว</span>}
        </div>
      </div>
    </form>
  );
}
