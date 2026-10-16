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

export function DocumentActions({ type, id, status }: { type: DocumentType; id: string; status: DocumentStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<Panel>("none");
  const [reason, setReason] = useState("");
  const [percent, setPercent] = useState("50");
  const label = DOC_META[type].label;

  function run(action: () => Promise<{ error?: string }>) {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {type === "quotation" && status === "accepted" && (
          <Button onClick={() => setPanel(panel === "invoice" ? "none" : "invoice")} disabled={pending}>
            สร้างใบแจ้งหนี้
          </Button>
        )}
        {type === "quotation" && status === "accepted" && (
          <Button variant="secondary" onClick={() => run(() => createDeliveryNoteFromQuotationAction(id))} disabled={pending}>
            สร้างใบส่งมอบงาน
          </Button>
        )}
        {editable && status === "issued" && (
          <Button onClick={() => run(() => setDocumentStatusAction(type, id, "sent"))} disabled={pending}>
            ทำเครื่องหมายว่าส่งแล้ว
          </Button>
        )}
        {awaitingResponse && (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                confirm(isDelivery ? "บันทึกว่าลูกค้าตรวจรับงานแล้ว?" : `บันทึกว่าลูกค้าตอบรับ${label}นี้?`) &&
                run(() => setDocumentStatusAction(type, id, "accepted"))
              }
              disabled={pending}
            >
              {isDelivery ? "ลูกค้าตรวจรับแล้ว" : "ลูกค้าตอบรับ"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                confirm(isDelivery ? "บันทึกว่าลูกค้าขอแก้ไขงาน?" : `บันทึกว่าลูกค้าปฏิเสธ${label}นี้?`) &&
                run(() => setDocumentStatusAction(type, id, "rejected"))
              }
              disabled={pending}
            >
              {isDelivery ? "ลูกค้าขอแก้ไข" : "ลูกค้าปฏิเสธ"}
            </Button>
          </>
        )}
        {editable && (
          <Button
            variant="secondary"
            onClick={() => run(() => duplicateDocumentAction(type as "quotation" | "invoice" | "delivery_note", id))}
            disabled={pending}
          >
            {status === "void" ? "ออกฉบับใหม่แทน" : "คัดลอกเป็นฉบับใหม่"}
          </Button>
        )}
        {status !== "void" && panel !== "void" && (
          <Button variant="danger" onClick={() => setPanel("void")} disabled={pending}>
            ยกเลิกเอกสาร
          </Button>
        )}
      </div>

      {panel === "invoice" && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-4">
          <p className="mb-3 text-sm font-medium text-brand-700">เรียกเก็บเงินจากใบเสนอราคานี้</p>
          <div className="flex flex-wrap items-end gap-3">
            <Button onClick={() => run(() => createInvoiceFromQuotationAction(id, null))} disabled={pending}>
              เต็มจำนวน (คัดลอกทุกรายการ)
            </Button>
            <span className="pb-2 text-sm text-stone-500">หรือ</span>
            <label className="text-sm">
              <span className="mb-1 block text-stone-600">แบ่งงวด / มัดจำ (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className={`${inputClass} w-28 text-right`}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => run(() => createInvoiceFromQuotationAction(id, Number(percent)))}
              disabled={pending || !(Number(percent) > 0 && Number(percent) <= 100)}
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
          <div className="flex flex-wrap gap-2">
            <input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น แก้ไขราคา / ลูกค้าเปลี่ยนขอบเขตงาน"
              className={`${inputClass} max-w-md flex-1`}
              autoFocus
            />
            <Button variant="danger" onClick={() => run(() => voidDocumentAction(type, id, reason))} disabled={pending || !reason.trim()}>
              ยืนยันยกเลิก
            </Button>
            <Button variant="ghost" onClick={() => setPanel("none")} disabled={pending}>
              ไม่ยกเลิก
            </Button>
          </div>
        </div>
      )}

      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}
