"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ErrorMessage, inputClass } from "@/components/ui";
import { DOC_META } from "@/lib/documents";
import type { DocumentStatus, DocumentType } from "@/lib/types";
import {
  createDeliveryNoteFromQuotationAction,
  createInvoiceFromQuotationAction,
  duplicateDocumentAction,
  setDocumentStatusAction,
  voidDocumentAction,
} from "@/app/(app)/documents/actions";

type Panel = "none" | "void" | "invoice";
type Editable = "quotation" | "invoice" | "delivery_note";

interface Action {
  key: string;
  label: string;
  run: () => void;
  danger?: boolean;
}

// One obvious next step per status, everything else under "การดำเนินการอื่น".
// When the next step lives in another panel (send the link, record a
// payment), the page passes a `hint` instead and no button is promoted here.
export function DocumentActions({ type, id, status, hint }: { type: DocumentType; id: string; status: DocumentStatus; hint?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<Panel>("none");
  const [reason, setReason] = useState("");
  const [percent, setPercent] = useState("50");
  const label = DOC_META[type].label;

  function perform(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else {
        setPanel("none");
        router.refresh();
      }
    });
  }

  const editable = type === "quotation" || type === "invoice" || type === "delivery_note";
  const isDelivery = type === "delivery_note";
  const awaitingResponse = (type === "quotation" || isDelivery) && (status === "issued" || status === "sent" || status === "viewed");
  const duplicate = () => perform(() => duplicateDocumentAction(type as Editable, id));

  const actions: Action[] = [];
  if (type === "quotation" && status === "accepted") {
    actions.push({ key: "invoice", label: "สร้างใบแจ้งหนี้", run: () => setPanel(panel === "invoice" ? "none" : "invoice") });
    actions.push({ key: "delivery", label: "สร้างใบส่งมอบงาน", run: () => perform(() => createDeliveryNoteFromQuotationAction(id)) });
  }
  if (editable && status === "issued") {
    actions.push({ key: "sent", label: "ทำเครื่องหมายว่าส่งแล้ว", run: () => perform(() => setDocumentStatusAction(type, id, "sent")) });
  }
  if (awaitingResponse) {
    actions.push({
      key: "accepted",
      label: isDelivery ? "บันทึกว่าลูกค้าตรวจรับแล้ว" : "บันทึกว่าลูกค้าตอบรับ",
      run: () =>
        confirm(isDelivery ? "บันทึกว่าลูกค้าตรวจรับงานแล้ว?" : `บันทึกว่าลูกค้าตอบรับ${label}นี้?`) &&
        perform(() => setDocumentStatusAction(type, id, "accepted")),
    });
    actions.push({
      key: "rejected",
      label: isDelivery ? "บันทึกว่าลูกค้าขอแก้ไข" : "บันทึกว่าลูกค้าปฏิเสธ",
      run: () =>
        confirm(isDelivery ? "บันทึกว่าลูกค้าขอแก้ไขงาน?" : `บันทึกว่าลูกค้าปฏิเสธ${label}นี้?`) &&
        perform(() => setDocumentStatusAction(type, id, "rejected")),
    });
  }
  if (editable) {
    const copyLabel =
      status === "void"
        ? "ออกฉบับใหม่แทน"
        : isDelivery && status === "rejected"
          ? "ส่งมอบรอบใหม่ (คัดลอกฉบับนี้)"
          : type === "quotation" && (status === "rejected" || status === "expired")
            ? "ทำใบเสนอราคาใหม่ (คัดลอกฉบับนี้)"
            : "คัดลอกเป็นฉบับใหม่";
    actions.push({ key: "duplicate", label: copyLabel, run: duplicate });
  }
  if (status !== "void") {
    actions.push({ key: "void", label: "ยกเลิกเอกสาร", run: () => setPanel("void"), danger: true });
  }

  // The promoted next step, if this component owns it.
  const primaryKey =
    type === "quotation" && status === "accepted"
      ? "invoice"
      : status === "void" || (status === "rejected" && editable) || (type === "quotation" && status === "expired")
        ? "duplicate"
        : null;
  const primary = actions.find((a) => a.key === primaryKey);
  const others = actions.filter((a) => a !== primary);

  return (
    <div className="space-y-3">
      {hint && <p className="text-sm text-stone-600">{hint}</p>}

      {primary && (
        <Button onClick={primary.run} disabled={pending} className="w-full">
          {primary.label}
        </Button>
      )}

      {panel === "invoice" && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3">
          <p className="mb-2 text-sm font-medium text-brand-700">เรียกเก็บเงินจากใบเสนอราคานี้</p>
          <Button onClick={() => perform(() => createInvoiceFromQuotationAction(id, null))} disabled={pending} className="w-full">
            เต็มจำนวน (คัดลอกทุกรายการ)
          </Button>
          <p className="my-2 text-center text-xs text-stone-500">หรือแบ่งงวด / มัดจำ</p>
          <div className="flex gap-2">
            <label className="relative w-24 shrink-0">
              <span className="sr-only">เปอร์เซ็นต์</span>
              <input
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className={`${inputClass} pr-7 text-right`}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-stone-500">%</span>
            </label>
            <Button
              variant="secondary"
              onClick={() => perform(() => createInvoiceFromQuotationAction(id, Number(percent)))}
              disabled={pending || !(Number(percent) > 0 && Number(percent) <= 100)}
              className="flex-1"
            >
              สร้างใบแจ้งหนี้ {Number(percent) || 0}%
            </Button>
          </div>
        </div>
      )}

      {panel === "void" && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
          <label className="mb-1 block text-sm font-medium text-red-800" htmlFor="void-reason">
            เหตุผลที่ยกเลิก
          </label>
          <input
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น แก้ไขราคา / ลูกค้าเปลี่ยนขอบเขตงาน"
            className={inputClass}
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <Button variant="danger" onClick={() => perform(() => voidDocumentAction(type, id, reason))} disabled={pending || !reason.trim()}>
              ยืนยันยกเลิก
            </Button>
            <Button variant="ghost" onClick={() => setPanel("none")} disabled={pending}>
              ไม่ยกเลิก
            </Button>
          </div>
        </div>
      )}

      {/* With no promoted step the actions are the panel's only content, so list them directly. */}
      {others.length > 0 && !primary && !hint && <ActionList actions={others} pending={pending} />}

      {/* Inline disclosure rather than a floating menu, so it never gets clipped by the scrolling side column. */}
      {others.length > 0 && (primary || hint) && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1 text-sm text-stone-600 hover:text-stone-900">
            การดำเนินการอื่น
            <span aria-hidden="true" className="text-stone-400 transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-1">
            <ActionList actions={others} pending={pending} />
          </div>
        </details>
      )}

      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}

function ActionList({ actions, pending }: { actions: Action[]; pending: boolean }) {
  return (
    <div className="-mx-2 flex flex-col">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.run}
          disabled={pending}
          className={`rounded-lg px-2 py-2 text-left text-sm transition disabled:opacity-50 ${
            a.danger ? "text-red-700 hover:bg-red-50" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
