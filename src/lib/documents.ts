import type { DocumentRow, DocumentType } from "@/lib/types";

export const DOC_META: Record<DocumentType, { label: string; english: string; path: string }> = {
  quotation: { label: "ใบเสนอราคา", english: "QUOTATION", path: "/quotations" },
  invoice: { label: "ใบแจ้งหนี้", english: "INVOICE", path: "/invoices" },
  receipt: { label: "ใบเสร็จรับเงิน", english: "RECEIPT", path: "/receipts" },
  delivery_note: { label: "ใบส่งมอบงาน", english: "DELIVERY NOTE", path: "/delivery-notes" },
};

const EVENT_LABEL: Record<string, string> = {
  issued: "ออกเอกสาร",
  sent: "ส่งให้ลูกค้า",
  viewed: "ลูกค้าเปิดดู",
  accepted: "ตอบรับ",
  rejected: "ปฏิเสธ",
  voided: "ยกเลิก",
};

/** Label for a document_events.event; delivery notes are signed off, not accepted. */
export function eventLabel(event: string, type?: DocumentType) {
  if (type === "delivery_note" && event === "accepted") return "ตรวจรับงาน";
  if (type === "delivery_note" && event === "rejected") return "ขอแก้ไขงาน";
  return EVENT_LABEL[event] ?? event;
}

/**
 * Title printed on a document. A receipt for a VAT invoice is also the tax
 * invoice (services are taxed when paid), so it carries both names.
 */
export function docLabel(doc: Pick<DocumentRow, "type" | "vat_rate">) {
  if (doc.type === "receipt" && Number(doc.vat_rate) > 0) {
    return { ...DOC_META.receipt, label: "ใบเสร็จรับเงิน/ใบกำกับภาษี", english: "RECEIPT / TAX INVOICE" };
  }
  return DOC_META[doc.type];
}

export const docPath = (type: DocumentType, id?: string) => (id ? `${DOC_META[type].path}/${id}` : DOC_META[type].path);

// Draft payload sent from the editor to save_document_draft().
export interface DraftHeader {
  client_id: string;
  title: string;
  issue_date: string;
  valid_until: string;
  due_date: string;
  discount_amount: string;
  vat_rate: string;
  wht_rate: string;
  scope_of_work: string;
  exclusions: string;
  revisions_included: string;
  payment_terms: string;
  notes: string;
}

export interface DraftItem {
  /** Set when the line was picked from the saved services list. */
  service_item_id?: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount_amount: string;
}

export interface DraftPayload {
  header: DraftHeader;
  items: DraftItem[];
}

export interface ActionResult {
  error?: string;
}
