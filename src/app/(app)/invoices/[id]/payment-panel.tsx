"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button, Card, ErrorMessage, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments";
import type { Payment, PaymentMethod } from "@/lib/types";
import {
  deletePaymentAction,
  issueReceiptAction,
  markWhtCertReceivedAction,
  recordPaymentAction,
  type PaymentFormState,
} from "../actions";

export type PaymentRow = Payment & { receipt: { id: string; number: string | null; status: string } | null };

interface Props {
  invoiceId: string;
  canRecord: boolean;
  payments: PaymentRow[];
  defaults: { cashDue: number; whtDue: number; today: string };
  /** Recording a payment is the page's next step (primary button). */
  emphasize?: boolean;
}

export function PaymentPanel({ invoiceId, canRecord, payments, defaults, emphasize = true }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState<PaymentFormState, FormData>(recordPaymentAction.bind(null, invoiceId), {});
  // The form stays open only for the save count it was opened at, so it
  // closes (and remounts empty) after each successful save.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const open = openedAt !== null && openedAt === (state.saved ?? 0);
  const setOpen = (value: boolean) => setOpenedAt(value ? (state.saved ?? 0) : null);
  const [wht, setWht] = useState(defaults.whtDue ? defaults.whtDue.toFixed(2) : "");
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string>();

  function run(action: () => Promise<{ error?: string }>) {
    setRowError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setRowError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold">การรับชำระเงิน</h2>
        {canRecord && !open && (
          <Button variant={emphasize ? "primary" : "secondary"} onClick={() => setOpen(true)}>
            + บันทึกรับเงิน
          </Button>
        )}
      </div>

      {open && (
        <form action={formAction} className="border-b border-stone-200 bg-stone-50/60 p-4">
          {/* Two columns: the panel sits in the narrow side column on wide screens. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันที่รับเงิน" className="col-span-2">
              <input name="received_on" type="date" required defaultValue={defaults.today} className={inputClass} />
            </Field>
            <Field label="รับจริง (บาท)">
              <input
                name="cash_amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={defaults.cashDue.toFixed(2)}
                className={`${inputClass} text-right`}
              />
            </Field>
            <Field label="หัก ณ ที่จ่าย (บาท)">
              <input
                name="wht_amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={wht}
                onChange={(e) => setWht(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} text-right`}
              />
            </Field>
            <Field label="ช่องทาง" className="col-span-2">
              <select name="method" defaultValue="transfer" className={inputClass}>
                {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="เลขอ้างอิง / หมายเหตุการโอน" className="col-span-2">
              <input name="reference" className={inputClass} />
            </Field>
            <Field label="ประเภทเงินได้ (ใช้สรุปยื่นภาษี)" className="col-span-2">
              <select name="income_type" defaultValue="40_2" className={inputClass}>
                <option value="40_2">40(2) ค่าจ้างทำงาน / ค่าบริการ</option>
                <option value="40_8">40(8) เงินได้อื่น ๆ</option>
                <option value="">ไม่ระบุ</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {Number(wht) > 0 && (
              <label className="flex items-center gap-2">
                <input type="checkbox" name="wht_cert_received" className="size-4 shrink-0 accent-brand-600" />
                ได้รับหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) แล้ว
              </label>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" name="issue_receipt" defaultChecked className="size-4 accent-brand-600" />
              ออกใบเสร็จรับเงินทันที
            </label>
          </div>
          <div className="mt-4 space-y-3">
            <ErrorMessage>{state.error}</ErrorMessage>
            <div className="flex gap-2">
              <SubmitButton>บันทึก</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        <p className="px-4 py-6 text-sm text-stone-500">ยังไม่มีการรับเงิน</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {payments.map((p) => {
            const liveReceipt = p.receipt && p.receipt.status !== "void" ? p.receipt : null;
            return (
              <li key={p.id} className="space-y-1.5 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{formatDate(p.received_on)}</span>
                  <span className="font-medium tabular-nums">{formatMoney(p.cash_amount)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs text-stone-500">
                  <span>
                    {paymentMethodLabel[p.method]}
                    {p.reference && ` · ${p.reference}`}
                  </span>
                  {Number(p.wht_amount) > 0 && <span className="tabular-nums">หัก ณ ที่จ่าย {formatMoney(p.wht_amount)}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
                  {liveReceipt ? (
                    <Link href={`/receipts/${liveReceipt.id}`} className="font-medium text-brand-700 hover:underline">
                      ใบเสร็จ {liveReceipt.number}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run(() => issueReceiptAction(p.id, invoiceId))}
                      disabled={pending}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      ออกใบเสร็จ
                    </button>
                  )}
                  {p.wht_cert_status === "received" && <span className="text-xs text-emerald-700">ได้รับ 50 ทวิ แล้ว</span>}
                  {p.wht_cert_status === "pending" && (
                    <button
                      type="button"
                      onClick={() => run(() => markWhtCertReceivedAction(p.id, invoiceId))}
                      disabled={pending}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      รอ 50 ทวิ · กดเมื่อได้รับ
                    </button>
                  )}
                  {!liveReceipt && (
                    <button
                      type="button"
                      onClick={() => confirm("ลบรายการรับเงินนี้?") && run(() => deletePaymentAction(p.id, invoiceId))}
                      disabled={pending}
                      className="ml-auto text-xs text-stone-400 hover:text-red-600"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rowError && (
        <div className="px-4 pb-4">
          <ErrorMessage>{rowError}</ErrorMessage>
        </div>
      )}
    </Card>
  );
}
