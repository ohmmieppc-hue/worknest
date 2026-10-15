"use client";

import { useActionState, useState } from "react";
import { ErrorMessage, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { clientKindLabel, clientStatusLabel } from "@/lib/format";
import type { Client, ClientKind } from "@/lib/types";
import type { ClientFormState } from "./actions";

interface Props {
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  client?: Client;
  next?: string;
  submitLabel: string;
}

export function ClientForm({ action, client, next, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, {});
  const [kind, setKind] = useState<ClientKind>(client?.kind ?? "individual");
  const [wht, setWht] = useState(client ? String(Number(client.default_wht_rate)) : "0");

  function changeKind(value: ClientKind) {
    setKind(value);
    // Companies normally withhold 3% on service fees; individuals don't.
    if (!client) setWht(value === "company" ? "3" : "0");
  }

  return (
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-700">ประเภทลูกค้า</legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {(Object.keys(clientKindLabel) as ClientKind[]).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                kind === k ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-stone-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => changeKind(k)}
                className="sr-only"
              />
              {clientKindLabel[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === "company" ? "ชื่อบริษัท / องค์กร *" : "ชื่อ-นามสกุล *"} className="sm:col-span-2">
          <input name="name" required defaultValue={client?.name} className={inputClass} />
        </Field>
        <Field label="เลขประจำตัวผู้เสียภาษี" hint="13 หลัก ใช้ออกเอกสารและป้องกันข้อมูลซ้ำ">
          <input name="tax_id" inputMode="numeric" maxLength={17} defaultValue={client?.tax_id ?? ""} className={inputClass} />
        </Field>
        {kind === "company" ? (
          <Field label="สาขา" hint="สำนักงานใหญ่ = 00000">
            <input
              name="branch_code"
              inputMode="numeric"
              maxLength={5}
              defaultValue={client?.branch_code ?? "00000"}
              className={inputClass}
            />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Field label="อีเมล">
          <input name="email" type="email" defaultValue={client?.email ?? ""} className={inputClass} />
        </Field>
        <Field label="โทรศัพท์">
          <input name="phone" type="tel" defaultValue={client?.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="ที่อยู่ (สำหรับออกเอกสาร)" className="sm:col-span-2">
          <textarea name="address" rows={3} defaultValue={client?.address ?? ""} className={inputClass} />
        </Field>
        <Field label="หัก ณ ที่จ่ายเริ่มต้น (%)" hint="ใช้เป็นค่าเริ่มต้นของใบเสนอราคาใหม่">
          <input
            name="default_wht_rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={wht}
            onChange={(e) => setWht(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="สถานะ">
          <select name="status" defaultValue={client?.status ?? "lead"} className={inputClass}>
            {Object.entries(clientStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="มาจากช่องทาง" hint="เช่น Facebook, เพื่อนแนะนำ, Fastwork">
          <input name="source" defaultValue={client?.source ?? ""} className={inputClass} />
        </Field>
        <Field label="หมายเหตุ" className="sm:col-span-2">
          <textarea name="notes" rows={2} defaultValue={client?.notes ?? ""} className={inputClass} />
        </Field>
      </div>

      <ErrorMessage>{state.error}</ErrorMessage>
      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {state.saved && <span className="text-sm text-brand-700">บันทึกแล้ว</span>}
      </div>
    </form>
  );
}
