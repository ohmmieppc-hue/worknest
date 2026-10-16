"use client";

import { useActionState, useRef, useState } from "react";
import { Button, ErrorMessage, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useConfirm } from "@/components/confirm-dialog";
import { formatMoney } from "@/lib/format";
import type { ServiceItem } from "@/lib/types";
import { archiveServiceAction, saveServiceAction, type ServiceFormState } from "./actions";

// One row of the services table: read-only until "แก้ไข", or an always-open
// form for adding a new item (service = null).
export function ServiceRow({ service }: { service: ServiceItem | null }) {
  const [state, action] = useActionState<ServiceFormState, FormData>(saveServiceAction.bind(null, service?.id ?? null), {});
  // Editing closes itself after each successful save (save count changes).
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const editing = !service || (editingAt !== null && editingAt === (state.saved ?? 0));
  const archiveForm = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();

  if (!editing && service) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium">{service.name}</p>
          {service.description && <p className="text-sm text-stone-500">{service.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums">
            {formatMoney(service.unit_price)} / {service.unit}
          </span>
          <Button variant="ghost" onClick={() => setEditingAt(state.saved ?? 0)}>
            แก้ไข
          </Button>
          <form ref={archiveForm} action={archiveServiceAction.bind(null, service.id)}>
            <Button
              type="button"
              variant="ghost"
              className="text-red-700"
              onClick={async () => {
                const ok = await confirm({
                  title: `ลบ "${service.name}" ออกจากรายการบริการ?`,
                  description: "เอกสารที่เคยใช้บริการนี้ไม่เปลี่ยนแปลง",
                  confirmLabel: "ลบ",
                  tone: "danger",
                });
                if (ok) archiveForm.current?.requestSubmit();
              }}
            >
              ลบ
            </Button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className={`px-4 py-3 ${service ? "bg-stone-50/60" : ""}`}>
      {/* key resets the inputs after a new item is added */}
      <form key={service ? service.id : `new-${state.saved ?? 0}`} action={action} className="grid gap-2 sm:grid-cols-[2fr_3fr_1fr_1fr_auto]">
        <input name="name" required defaultValue={service?.name} placeholder="ชื่อบริการ" aria-label="ชื่อบริการ" className={inputClass} />
        <input name="description" defaultValue={service?.description ?? ""} placeholder="รายละเอียด (ไม่บังคับ)" aria-label="รายละเอียด" className={inputClass} />
        <input
          name="unit_price"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          required
          defaultValue={service ? Number(service.unit_price) : ""}
          placeholder="ราคา"
          aria-label="ราคาต่อหน่วย"
          className={`${inputClass} text-right`}
        />
        <input name="unit" defaultValue={service?.unit ?? "งาน"} placeholder="หน่วย" aria-label="หน่วย" className={inputClass} />
        <div className="flex gap-2">
          <SubmitButton pendingText="…">{service ? "บันทึก" : "+ เพิ่ม"}</SubmitButton>
          {service && (
            <Button type="button" variant="ghost" onClick={() => setEditingAt(null)}>
              ยกเลิก
            </Button>
          )}
        </div>
      </form>
      {state.error && (
        <div className="mt-2">
          <ErrorMessage>{state.error}</ErrorMessage>
        </div>
      )}
    </li>
  );
}
