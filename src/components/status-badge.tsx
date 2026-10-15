import { clientStatusLabel, documentStatusLabel } from "@/lib/format";
import type { ClientStatus, DocumentStatus } from "@/lib/types";

const documentTone: Record<DocumentStatus, string> = {
  draft: "bg-stone-100 text-stone-700",
  issued: "bg-sky-50 text-sky-700",
  sent: "bg-sky-50 text-sky-700",
  viewed: "bg-indigo-50 text-indigo-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-amber-50 text-amber-800",
  void: "bg-stone-100 text-stone-500 line-through",
};

const clientTone: Record<ClientStatus, string> = {
  lead: "bg-amber-50 text-amber-800",
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-stone-100 text-stone-500",
};

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <span className={`${base} ${documentTone[status]}`}>{documentStatusLabel[status]}</span>;
}

export type PaymentStatus = "unpaid" | "partially_paid" | "paid";

const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: "ยังไม่ชำระ",
  partially_paid: "ชำระบางส่วน",
  paid: "ชำระครบแล้ว",
};
const paymentTone: Record<PaymentStatus, string> = {
  unpaid: "bg-amber-50 text-amber-800",
  partially_paid: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
};

export function PaymentStatusBadge({ status, overdue }: { status: PaymentStatus; overdue?: boolean }) {
  if (overdue) return <span className={`${base} bg-red-50 text-red-700`}>เกินกำหนด</span>;
  return <span className={`${base} ${paymentTone[status]}`}>{paymentLabel[status]}</span>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`${base} ${clientTone[status]}`}>{clientStatusLabel[status]}</span>;
}
