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
}

export function PaymentPanel({ invoiceId, canRecord, payments, defaults }: Props) {
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
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold">การรับชำระเงิน</h2>
        {canRecord && !open && (
          <Button onClick={() => setOpen(true)}>+ บันทึกรับเงิน</Button>
        )}
      </div>

      {open && (
        <form action={formAction} className="border-b border-stone-200 bg-stone-50/60 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="วันที่รับเงิน">
              <input name="received_on" type="date" required defaultValue={defaults.today} className={inputClass} />
            </Field>
            <Field label="เงินที่ได้รับจริง (บาท)">
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
            <Field label="ลูกค้าหัก ณ ที่จ่าย (บาท)">
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
            <Field label="ช่องทาง">
              <select name="method" defaultValue="transfer" className={inputClass}>
                {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="เลขอ้างอิง / หมายเหตุการโอน" className="sm:col-span-2">
              <input name="reference" className={inputClass} />
            </Field>
            <Field label="ประเภทเงินได้ (ใช้สรุปยื่นภาษี)" className="sm:col-span-2">
              <select name="income_type" defaultValue="40_2" className={inputClass}>
                <option value="40_2">40(2) ค่าจ้างทำงาน / ค่าบริการ</option>
                <option value="40_8">40(8) เงินได้อื่น ๆ</option>
                <option value="">ไม่ระบุ</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {Number(wht) > 0 && (
              <label className="flex items-center gap-2">
                <input type="checkbox" name="wht_cert_received" className="size-4 accent-brand-600" />
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">วันที่</th>
                <th className="px-4 py-2 text-right font-medium">รับจริง</th>
                <th className="px-4 py-2 text-right font-medium">หัก ณ ที่จ่าย</th>
                <th className="px-4 py-2 font-medium">ช่องทาง</th>
                <th className="px-4 py-2 font-medium">50 ทวิ</th>
                <th className="px-4 py-2 font-medium">ใบเสร็จ</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {payments.map((p) => {
                const liveReceipt = p.receipt && p.receipt.status !== "void" ? p.receipt : null;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(p.received_on)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(p.cash_amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(p.wht_amount) ? formatMoney(p.wht_amount) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {paymentMethodLabel[p.method]}
                      {p.reference && <div className="text-xs text-stone-500">{p.reference}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.wht_cert_status === "not_applicable" && "—"}
                      {p.wht_cert_status === "received" && <span className="text-emerald-700">ได้รับแล้ว</span>}
                      {p.wht_cert_status === "pending" && (
                        <button
                          type="button"
                          onClick={() => run(() => markWhtCertReceivedAction(p.id, invoiceId))}
                          disabled={pending}
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          รอรับ · ทำเครื่องหมายว่าได้รับ
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {liveReceipt ? (
                        <Link href={`/receipts/${liveReceipt.id}`} className="font-medium text-brand-700 hover:underline">
                          {liveReceipt.number}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => run(() => issueReceiptAction(p.id, invoiceId))}
                          disabled={pending}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          ออกใบเสร็จ
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!liveReceipt && (
                        <button
                          type="button"
                          onClick={() => confirm("ลบรายการรับเงินนี้?") && run(() => deletePaymentAction(p.id, invoiceId))}
                          disabled={pending}
                          aria-label="ลบรายการรับเงิน"
                          className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rowError && (
        <div className="px-4 pb-4">
          <ErrorMessage>{rowError}</ErrorMessage>
        </div>
      )}
    </Card>
  );
}
