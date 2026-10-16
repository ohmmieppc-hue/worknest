import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import type { createClient } from "@/lib/supabase/server";
import type { Client, ClientResponse, DocumentItem, DocumentRow, DocumentType, ScheduleRow, ServiceItem } from "@/lib/types";
import type { DraftScheduleRow } from "@/lib/documents";

export async function loadDocument(type: DocumentType, id: string) {
  const { supabase } = await requireWorkspace();
  const [{ data: docData }, { data: itemData }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).eq("type", type).maybeSingle(),
    supabase.from("document_items").select("*").eq("document_id", id).order("sort_order"),
  ]);
  if (!docData) notFound();
  return { supabase, doc: docData as DocumentRow, items: (itemData ?? []) as DocumentItem[] };
}

// The latest accept / reject event: who signed off (or asked for changes) and why.
export async function loadClientResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  doc: Pick<DocumentRow, "id" | "status">,
): Promise<ClientResponse | null> {
  if (doc.status !== "accepted" && doc.status !== "rejected") return null;
  const { data } = await supabase
    .from("document_events")
    .select("actor, actor_name, created_at, metadata")
    .eq("document_id", doc.id)
    .eq("event", doc.status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { metadata, ...rest } = data as Omit<ClientResponse, "note"> & { metadata: { note?: string } | null };
  return { ...rest, note: metadata?.note ?? null };
}

export async function loadSchedule(supabase: Awaited<ReturnType<typeof createClient>>, quotationId: string) {
  const { data } = await supabase
    .from("payment_schedules")
    .select("id, label, percent, amount, due_rule, due_date, invoice_id")
    .eq("quotation_id", quotationId)
    .order("sort_order");
  return (data ?? []) as ScheduleRow[];
}

/** Saved installments in the shape the editor and save_payment_schedule() use. */
export const toDraftSchedule = (rows: ScheduleRow[]): DraftScheduleRow[] =>
  rows.map((r) => ({
    label: r.label,
    percent: r.percent ?? "",
    amount: r.amount ?? "",
    due_rule: r.due_rule === "on_milestone" ? "manual" : r.due_rule,
    due_date: r.due_date ?? "",
  }));

// Active clients plus the document's own client, even if it was archived since.
export async function loadClientOptions(currentClientId: string) {
  const { supabase } = await requireWorkspace();
  const { data } = await supabase
    .from("clients")
    .select("id, name")
    .or(`archived_at.is.null,id.eq.${currentClientId}`)
    .order("name");
  return (data ?? []) as Pick<Client, "id" | "name">[];
}

export async function loadShareLinks(documentId: string) {
  const { supabase } = await requireWorkspace();
  const { data } = await supabase
    .from("share_links")
    .select("id, created_at, expires_at, revoked_at, last_accessed_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as {
    id: string;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    last_accessed_at: string | null;
  }[];
}

export async function loadDocumentNumber(id: string | null) {
  if (!id) return null;
  const { supabase } = await requireWorkspace();
  const { data } = await supabase.from("documents").select("id, type, number").eq("id", id).maybeSingle();
  return data as Pick<DocumentRow, "id" | "type" | "number"> | null;
}

export async function loadServiceOptions() {
  const { supabase } = await requireWorkspace();
  const { data } = await supabase.from("service_items").select("*").is("archived_at", null).order("name");
  return (data ?? []) as ServiceItem[];
}

/**
 * PostgREST `or` filter matching a document's number, title or client name.
 * Client names live in another table, so matching clients are looked up first.
 */
export async function documentSearchFilter(supabase: Awaited<ReturnType<typeof createClient>>, term: string) {
  const { data } = await supabase.from("clients").select("id").ilike("name", `%${term}%`).limit(200);
  const clientIds = (data ?? []).map((c) => c.id as string);
  return [`number.ilike.%${term}%`, `title.ilike.%${term}%`, clientIds.length ? `client_id.in.(${clientIds.join(",")})` : null]
    .filter(Boolean)
    .join(",");
}
