// Hand-written row types for db/schema.sql.
// Replace with `supabase gen types typescript` once the project is linked.

export type ClientKind = "individual" | "company";
export type ClientStatus = "lead" | "active" | "inactive";
export type DocumentType = "quotation" | "invoice" | "receipt" | "delivery_note";
export type DocumentStatus =
  | "draft"
  | "issued"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "void";

export interface BankAccount {
  bank: string;
  account_no: string;
  account_name: string;
}

export interface Workspace {
  id: string;
  display_name: string;
  legal_name: string;
  tax_id: string | null;
  branch_code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  promptpay_id: string | null;
  bank_accounts: BankAccount[];
  vat_registered: boolean;
  default_quote_valid_days: number;
  default_credit_days: number;
  default_wht_rate: string;
}

export interface Client {
  id: string;
  workspace_id: string;
  kind: ClientKind;
  name: string;
  tax_id: string | null;
  branch_code: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  default_wht_rate: string;
  source: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface PartySnapshot {
  legal_name?: string;
  name?: string;
  tax_id: string | null;
  branch_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

// numeric columns arrive as strings from PostgREST.
export interface DocumentRow {
  id: string;
  workspace_id: string;
  type: DocumentType;
  number: string | null;
  status: DocumentStatus;
  client_id: string;
  project_id: string | null;
  source_document_id: string | null;
  replaces_document_id: string | null;
  title: string | null;
  issue_date: string;
  valid_until: string | null;
  due_date: string | null;
  subtotal: string;
  discount_amount: string;
  vat_rate: string;
  vat_amount: string;
  total: string;
  wht_rate: string;
  wht_amount: string;
  amount_payable: string;
  scope_of_work: string | null;
  exclusions: string | null;
  revisions_included: number | null;
  payment_terms: string | null;
  notes: string | null;
  seller_snapshot: PartySnapshot | null;
  buyer_snapshot: PartySnapshot | null;
  issued_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  unit_price: string;
}

export interface InvoiceBalance {
  invoice_id: string;
  total: string;
  amount_payable: string;
  cash_received: string;
  wht_withheld: string;
  settled: string;
  outstanding: string;
  payment_status: "unpaid" | "partially_paid" | "paid";
  is_overdue: boolean;
}

export type PaymentMethod = "transfer" | "promptpay" | "cash" | "cheque" | "other";
export type WhtCertStatus = "not_applicable" | "pending" | "received";

export interface Payment {
  id: string;
  workspace_id: string;
  invoice_id: string;
  received_on: string;
  cash_amount: string;
  wht_amount: string;
  method: PaymentMethod;
  reference: string | null;
  wht_cert_status: WhtCertStatus;
  income_type: "40_2" | "40_8" | null;
  receipt_id: string | null;
  note: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  sort_order: number;
  service_item_id: string | null;
  description: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  discount_amount: string;
  amount: string;
}
