import type { DocumentType } from "@/lib/types";

export const DOC_META: Record<DocumentType, { label: string; english: string; path: string }> = {
  quotation: { label: "ใบเสนอราคา", english: "QUOTATION", path: "/quotations" },
  invoice: { label: "ใบแจ้งหนี้", english: "INVOICE", path: "/invoices" },
  receipt: { label: "ใบเสร็จรับเงิน", english: "RECEIPT", path: "/receipts" },
  delivery_note: { label: "ใบส่งมอบงาน", english: "DELIVERY NOTE", path: "/delivery-notes" },
};

export const docPath = (type: DocumentType, id?: string) => (id ? `${DOC_META[type].path}/${id}` : DOC_META[type].path);

// Draft payload sent from the editor to save_document_draft().
export interface DraftHeader {
  client_id: string;
  title: string;
  issue_date: string;
  valid_until: string;
  due_date: string;
  discount_amount: string;
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
