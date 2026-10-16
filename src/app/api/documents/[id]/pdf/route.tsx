import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { DocumentPdf } from "@/lib/pdf/document-pdf";
import { buildPdfExtras, pdfResponse } from "@/lib/pdf/extras";
import { getSession } from "@/lib/workspace";
import { loadClientResponse, loadSchedule } from "@/lib/document-data";
import type { DocumentItem, DocumentRow, InvoiceBalance, Payment } from "@/lib/types";

// GET /api/documents/:id/pdf            → shown inline
// GET /api/documents/:id/pdf?download=1 → saved as <number>.pdf
export async function GET(request: NextRequest, { params }: RouteContext<"/api/documents/[id]/pdf">) {
  const { id } = await params;
  const { supabase, workspace } = await getSession();
  if (!workspace) return NextResponse.json({ error: "no workspace" }, { status: 403 });

  // RLS limits these reads to the caller's workspace.
  const [{ data: docData }, { data: itemData }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).maybeSingle(),
    supabase.from("document_items").select("*").eq("document_id", id).order("sort_order"),
  ]);
  const doc = docData as DocumentRow | null;
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (doc.status === "draft") return NextResponse.json({ error: "drafts have no PDF" }, { status: 409 });

  const [{ data: source }, { data: payment }, { data: balance }, response, schedule] = await Promise.all([
    doc.source_document_id
      ? supabase.from("documents").select("number").eq("id", doc.source_document_id).maybeSingle()
      : Promise.resolve({ data: null }),
    doc.type === "receipt" ? supabase.from("payments").select("*").eq("receipt_id", doc.id).maybeSingle() : Promise.resolve({ data: null }),
    doc.type === "invoice" ? supabase.from("invoice_balances").select("*").eq("invoice_id", doc.id).maybeSingle() : Promise.resolve({ data: null }),
    doc.type === "delivery_note" ? loadClientResponse(supabase, doc) : Promise.resolve(null),
    doc.type === "quotation" ? loadSchedule(supabase, doc.id) : Promise.resolve(null),
  ]);

  const extras = await buildPdfExtras({
    doc,
    balance: balance as InvoiceBalance | null,
    payment: payment as Payment | null,
    reference: (source as { number: string | null } | null)?.number ?? null,
    response,
    schedule,
  });
  const pdf = await renderToBuffer(<DocumentPdf doc={doc} items={(itemData ?? []) as DocumentItem[]} extras={extras} />);
  return pdfResponse(pdf, doc.number, doc.id, !!request.nextUrl.searchParams.get("download"));
}
