import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import type { Client, DocumentItem, DocumentRow, DocumentType, ServiceItem } from "@/lib/types";

export async function loadDocument(type: DocumentType, id: string) {
  const { supabase } = await requireWorkspace();
  const [{ data: docData }, { data: itemData }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).eq("type", type).maybeSingle(),
    supabase.from("document_items").select("*").eq("document_id", id).order("sort_order"),
  ]);
  if (!docData) notFound();
  return { supabase, doc: docData as DocumentRow, items: (itemData ?? []) as DocumentItem[] };
}

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
