import type { ClientKind, ClientStatus, DocumentStatus, DocumentType } from "@/lib/types";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: string | number | null | undefined) {
  return money.format(Number(value ?? 0));
}

// th-TH uses the Buddhist calendar (พ.ศ.) by default.
const dateFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  // Date-only columns ("2026-10-16") are parsed as local noon to avoid TZ shifts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
  return dateFmt.format(d);
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const documentStatusLabel: Record<DocumentStatus, string> = {
  draft: "ร่าง",
  issued: "ออกแล้ว",
  sent: "ส่งแล้ว",
  viewed: "ลูกค้าเปิดดูแล้ว",
  accepted: "ตอบรับแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดอายุ",
  void: "ยกเลิก",
};

// Delivery notes are signed off rather than "accepted".
export function statusLabel(status: DocumentStatus, type?: DocumentType) {
  if (type === "delivery_note" && status === "accepted") return "ตรวจรับแล้ว";
  if (type === "delivery_note" && status === "rejected") return "ขอแก้ไข";
  return documentStatusLabel[status];
}

export const clientStatusLabel: Record<ClientStatus, string> = {
  lead: "Lead",
  active: "ลูกค้าปัจจุบัน",
  inactive: "ไม่ active",
};

export const clientKindLabel: Record<ClientKind, string> = {
  individual: "บุคคลธรรมดา",
  company: "นิติบุคคล",
};
