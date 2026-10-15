"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";
import { addDaysISO, todayISO } from "@/lib/format";
import { docPath, type ActionResult, type DraftPayload } from "@/lib/documents";
import type { DocumentItem, DocumentRow, DocumentStatus, DocumentType, Workspace } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof requireWorkspace>>["supabase"];
type EditableType = Extract<DocumentType, "quotation" | "invoice">;

function validate({ header, items }: DraftPayload, forIssue: boolean): string | null {
  if (!header.client_id) return "เลือกลูกค้า";
  const filled = items.filter((i) => i.description.trim());
  if (forIssue && filled.length === 0) return "ต้องมีรายการอย่างน้อย 1 รายการก่อนออกเอกสาร";
  for (const i of filled) {
    if (!(Number(i.quantity) > 0)) return `จำนวนของ "${i.description}" ต้องมากกว่า 0`;
    if (!(Number(i.unit_price) >= 0)) return `ราคาของ "${i.description}" ไม่ถูกต้อง`;
  }
  const wht = Number(header.wht_rate || 0);
  if (!(wht >= 0 && wht <= 100)) return "อัตราหัก ณ ที่จ่ายไม่ถูกต้อง";
  if (header.valid_until && header.issue_date && header.valid_until < header.issue_date) {
    return "วันยืนราคาต้องไม่ก่อนวันที่ออกเอกสาร";
  }
  if (header.due_date && header.issue_date && header.due_date < header.issue_date) {
    return "วันครบกำหนดต้องไม่ก่อนวันที่ออกเอกสาร";
  }
  return null;
}

async function saveDraft(supabase: Supabase, id: string, payload: DraftPayload) {
  const items = payload.items
    .filter((i) => i.description.trim())
    .map((i) => ({ ...i, description: i.description.trim(), discount_amount: i.discount_amount || "0" }));
  return supabase.rpc("save_document_draft", { p_id: id, p_header: payload.header, p_items: items });
}

async function logEvent(supabase: Supabase, doc: Pick<DocumentRow, "id" | "workspace_id">, event: string, metadata = {}) {
  await supabase.from("document_events").insert({
    workspace_id: doc.workspace_id,
    document_id: doc.id,
    event,
    actor: "owner",
    metadata,
  });
}

function revalidate(type: DocumentType, id: string) {
  revalidatePath(docPath(type));
  revalidatePath(docPath(type, id));
}

function defaultDates(type: EditableType, workspace: Workspace) {
  const today = todayISO();
  return {
    issue_date: today,
    valid_until: type === "quotation" ? addDaysISO(today, workspace.default_quote_valid_days) : "",
    due_date: type === "invoice" ? addDaysISO(today, workspace.default_credit_days) : "",
  };
}

export async function createDocumentAction(type: EditableType, formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const { supabase, workspace } = await requireWorkspace();

  const { data: client } = await supabase.from("clients").select("id, default_wht_rate").eq("id", clientId).maybeSingle();
  if (!client) redirect(`${docPath(type)}/new?error=client`);

  const dates = defaultDates(type, workspace);
  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspace.id,
      type,
      client_id: client.id,
      issue_date: dates.issue_date,
      valid_until: dates.valid_until || null,
      due_date: dates.due_date || null,
      wht_rate: client.default_wht_rate,
    })
    .select("id")
    .single();
  if (error) redirect(`${docPath(type)}/new?error=${encodeURIComponent(toThaiError(error))}`);

  revalidatePath(docPath(type));
  redirect(docPath(type, data.id));
}

export async function saveDraftAction(type: DocumentType, id: string, payload: DraftPayload): Promise<ActionResult> {
  const invalid = validate(payload, false);
  if (invalid) return { error: invalid };

  const { supabase } = await requireWorkspace();
  const { error } = await saveDraft(supabase, id, payload);
  if (error) return { error: toThaiError(error) };

  revalidate(type, id);
  return {};
}

export async function issueDocumentAction(type: DocumentType, id: string, payload: DraftPayload): Promise<ActionResult> {
  const invalid = validate(payload, true);
  if (invalid) return { error: invalid };

  const { supabase } = await requireWorkspace();
  const saved = await saveDraft(supabase, id, payload);
  if (saved.error) return { error: toThaiError(saved.error) };

  const { data, error } = await supabase
    .from("documents")
    .update({ status: "issued" })
    .eq("id", id)
    .select("id, workspace_id, number")
    .single();
  if (error) return { error: toThaiError(error) };

  await logEvent(supabase, data, "issued", { number: data.number });
  revalidate(type, id);
  return {};
}

const MANUAL_STATUSES: DocumentStatus[] = ["sent", "accepted", "rejected"];

export async function setDocumentStatusAction(type: DocumentType, id: string, status: DocumentStatus): Promise<ActionResult> {
  if (!MANUAL_STATUSES.includes(status)) return { error: "สถานะไม่ถูกต้อง" };

  const { supabase } = await requireWorkspace();
  const { data, error } = await supabase
    .from("documents")
    .update({ status })
    .eq("id", id)
    .select("id, workspace_id")
    .single();
  if (error) return { error: toThaiError(error) };

  await logEvent(supabase, data, status, { recorded_manually: status !== "sent" });
  revalidate(type, id);
  revalidatePath("/clients");
  return {};
}

export async function voidDocumentAction(type: DocumentType, id: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { error: "ระบุเหตุผลที่ยกเลิก" };

  const { supabase } = await requireWorkspace();
  const { data, error } = await supabase
    .from("documents")
    .update({ status: "void", void_reason: reason.trim() })
    .eq("id", id)
    .select("id, workspace_id, source_document_id")
    .single();
  if (error) return { error: toThaiError(error) };

  await logEvent(supabase, data, "voided", { reason: reason.trim() });
  revalidate(type, id);
  // A voided receipt changes what its invoice page shows.
  if (data.source_document_id) revalidatePath(docPath("invoice", data.source_document_id));
  return {};
}

export async function deleteDraftAction(type: DocumentType, id: string): Promise<ActionResult> {
  const { supabase } = await requireWorkspace();
  const { error } = await supabase.from("documents").delete().eq("id", id).eq("status", "draft");
  if (error) return { error: toThaiError(error) };

  revalidatePath(docPath(type));
  redirect(docPath(type));
}

function toDraftItems(items: DocumentItem[]) {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unit: i.unit ?? "",
    unit_price: i.unit_price,
    discount_amount: i.discount_amount,
  }));
}

// Copies a document into a new draft of the same type. When the source is
// void, the copy is recorded as its replacement.
export async function duplicateDocumentAction(type: EditableType, id: string): Promise<ActionResult> {
  const { supabase, workspace } = await requireWorkspace();
  const [{ data: src }, { data: srcItems }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).single(),
    supabase.from("document_items").select("*").eq("document_id", id).order("sort_order"),
  ]);
  if (!src) return { error: "ไม่พบเอกสาร" };
  const doc = src as DocumentRow;

  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspace.id,
      type,
      client_id: doc.client_id,
      project_id: doc.project_id,
      // An invoice copy still bills the same quotation.
      source_document_id: doc.source_document_id,
      replaces_document_id: doc.status === "void" ? doc.id : null,
    })
    .select("id")
    .single();
  if (error) return { error: toThaiError(error) };

  const saved = await saveDraft(supabase, created.id, {
    header: {
      ...defaultDates(type, workspace),
      client_id: doc.client_id,
      title: doc.title ?? "",
      discount_amount: doc.discount_amount,
      wht_rate: doc.wht_rate,
      scope_of_work: doc.scope_of_work ?? "",
      exclusions: doc.exclusions ?? "",
      revisions_included: doc.revisions_included?.toString() ?? "",
      payment_terms: doc.payment_terms ?? "",
      notes: doc.notes ?? "",
    },
    items: toDraftItems((srcItems ?? []) as DocumentItem[]),
  });
  if (saved.error) return { error: toThaiError(saved.error) };

  revalidatePath(docPath(type));
  redirect(docPath(type, created.id));
}

// Bills an accepted quotation: in full (copies every line) or as one
// percentage line such as a 50% deposit.
export async function createInvoiceFromQuotationAction(quotationId: string, percent: number | null): Promise<ActionResult> {
  if (percent != null && !(percent > 0 && percent <= 100)) return { error: "เปอร์เซ็นต์ต้องอยู่ระหว่าง 1–100" };

  const { supabase, workspace } = await requireWorkspace();
  const [{ data: src }, { data: srcItems }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", quotationId).eq("type", "quotation").single(),
    supabase.from("document_items").select("*").eq("document_id", quotationId).order("sort_order"),
  ]);
  if (!src) return { error: "ไม่พบใบเสนอราคา" };
  const quote = src as DocumentRow;
  if (quote.status !== "accepted") return { error: "ออกใบแจ้งหนี้ได้เมื่อลูกค้าตอบรับใบเสนอราคาแล้ว" };

  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspace.id,
      type: "invoice",
      client_id: quote.client_id,
      project_id: quote.project_id,
      source_document_id: quote.id,
    })
    .select("id")
    .single();
  if (error) return { error: toThaiError(error) };

  const base = Number(quote.subtotal) - Number(quote.discount_amount);
  const items =
    percent == null
      ? toDraftItems((srcItems ?? []) as DocumentItem[])
      : [
          {
            description: `ค่าบริการงวด ${percent}% ตามใบเสนอราคาเลขที่ ${quote.number}${quote.title ? ` (${quote.title})` : ""}`,
            quantity: "1",
            unit: "งวด",
            unit_price: (Math.round(base * percent) / 100).toFixed(2),
            discount_amount: "0",
          },
        ];

  const saved = await saveDraft(supabase, created.id, {
    header: {
      ...defaultDates("invoice", workspace),
      client_id: quote.client_id,
      title: quote.title ?? "",
      discount_amount: percent == null ? quote.discount_amount : "0",
      wht_rate: quote.wht_rate,
      scope_of_work: "",
      exclusions: "",
      revisions_included: "",
      payment_terms: quote.payment_terms ?? "",
      notes: `อ้างอิงใบเสนอราคาเลขที่ ${quote.number}`,
    },
    items,
  });
  if (saved.error) return { error: toThaiError(saved.error) };

  revalidatePath(docPath("invoice"));
  revalidatePath(docPath("quotation", quote.id));
  redirect(docPath("invoice", created.id));
}
