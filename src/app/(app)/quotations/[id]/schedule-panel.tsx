"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, ErrorMessage } from "@/components/ui";
import { DocumentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";
import { dueText, installmentAmount, installmentPercent } from "@/lib/schedule";
import type { DocumentStatus, ScheduleRow } from "@/lib/types";
import { createInvoiceFromScheduleAction } from "@/app/(app)/documents/actions";

export interface LinkedInvoice {
  id: string;
  number: string | null;
  status: DocumentStatus;
  payment?: { status: "unpaid" | "partially_paid" | "paid"; overdue: boolean } | null;
}

/**
 * Installments of an accepted quotation: what each one is, whether it has been
 * invoiced and paid, and a button to bill the next one.
 */
export function SchedulePanel({
  rows,
  base,
  invoices,
  canBill,
  billedTotal = 0,
}: {
  rows: (ScheduleRow & { id: string })[];
  base: number;
  invoices: Record<string, LinkedInvoice>;
  canBill: boolean;
  /** Pre-VAT amount of every live invoice from this quotation, scheduled or not. */
  billedTotal?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const invoiceOf = (r: ScheduleRow) => {
    const inv = r.invoice_id ? invoices[r.invoice_id] : undefined;
    return inv && inv.status !== "void" ? inv : null;
  };
  const billed = rows.filter((r) => invoiceOf(r)).reduce((s, r) => s + installmentAmount(r, base), 0);
  const next = rows.find((r) => !invoiceOf(r));
  // Invoices made with the manual "สร้างใบแจ้งหนี้" button are not tied to an installment.
  const outside = billedTotal - billed;

  function bill(id: string) {
    setError(undefined);
    startTransition(async () => {
      const result = await createInvoiceFromScheduleAction(id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold">งวดชำระ</h2>
        <p className="text-xs text-stone-500">
          เรียกเก็บแล้ว {formatMoney(billed)} จาก {formatMoney(base)} บาท
          {base > 0 && ` (${Math.round((billed / base) * 1000) / 10}%)`}
        </p>
        {outside > 0.005 && (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            มีใบแจ้งหนี้ที่ออกแยกจากงวดอีก {formatMoney(outside)} บาท ตรวจสอบก่อนเรียกเก็บงวดถัดไป
          </p>
        )}
      </div>
      <ol className="divide-y divide-stone-100 text-sm">
        {rows.map((r, i) => {
          const inv = invoiceOf(r);
          return (
            <li key={r.id} className="space-y-1.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {i + 1}. {r.label}
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(installmentAmount(r, base))}</span>
              </div>
              <p className="text-xs text-stone-500">
                {Math.round(installmentPercent(r, base) * 100) / 100}% · {dueText(r)}
              </p>
              {inv ? (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-700 hover:underline">
                    {inv.number ?? "ใบแจ้งหนี้ (ร่าง)"}
                  </Link>
                  {inv.payment ? (
                    <PaymentStatusBadge status={inv.payment.status} overdue={inv.payment.overdue} />
                  ) : (
                    <DocumentStatusBadge status={inv.status} />
                  )}
                </div>
              ) : (
                canBill && (
                  <Button
                    variant={r === next ? "primary" : "secondary"}
                    onClick={() => bill(r.id)}
                    disabled={pending}
                    className={r === next ? "w-full" : ""}
                  >
                    {pending ? "กำลังสร้าง…" : "ออกใบแจ้งหนี้งวดนี้"}
                  </Button>
                )
              )}
            </li>
          );
        })}
      </ol>
      {error && (
        <div className="px-4 pb-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </Card>
  );
}
