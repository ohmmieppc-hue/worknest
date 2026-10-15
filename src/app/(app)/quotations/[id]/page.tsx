import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DocumentEditor } from "@/components/document-editor";
import { DocumentPaper, VoidNotice } from "@/components/document-paper";
import { loadClientOptions, loadDocument, loadShareLinks } from "@/lib/document-data";
import { formatMoney } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";

export const metadata: Metadata = { title: "ใบเสนอราคา" };

export default async function QuotationPage({ params }: PageProps<"/quotations/[id]">) {
  const { id } = await params;
  const { supabase, doc, items } = await loadDocument("quotation", id);
  const shareLinks = doc.status === "draft" ? [] : await loadShareLinks(doc.id);

  if (doc.status === "draft") {
    const clients = await loadClientOptions(doc.client_id);
    return (
      <div>
        <PageHeader
          title="ใบเสนอราคา (ร่าง)"
          description="เลขที่เอกสารจะถูกออกให้อัตโนมัติเมื่อกด “ออกใบเสนอราคา”"
          actions={<DocumentStatusBadge status={doc.status} />}
        />
        <DocumentEditor doc={{ ...doc, type: "quotation" }} items={items} clients={clients} />
      </div>
    );
  }

  const { data: invoiceData } = await supabase
    .from("documents")
    .select("id, number, status, total")
    .eq("type", "invoice")
    .eq("source_document_id", doc.id)
    .order("created_at");
  const invoices = (invoiceData ?? []) as Pick<DocumentRow, "id" | "number" | "status" | "total">[];

  return (
    <div>
      {/* Everything above the document itself is screen-only. */}
      <div className="print:hidden">
        <div className="mb-2 text-sm">
          <Link href="/quotations" className="text-stone-500 hover:text-stone-800">
            ← ใบเสนอราคาทั้งหมด
          </Link>
        </div>
        <PageHeader title={`ใบเสนอราคา ${doc.number}`} actions={<DocumentStatusBadge status={doc.status} />} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <DocumentActions type="quotation" id={doc.id} status={doc.status} />
          <DocumentExport id={doc.id} />
        </div>

        <VoidNotice doc={doc} />

        {doc.status !== "void" && <SharePanel type="quotation" documentId={doc.id} links={shareLinks} />}

        {invoices.length > 0 && (
          <Card className="mb-6 overflow-hidden">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">ใบแจ้งหนี้จากใบเสนอราคานี้</h2>
            <ul className="divide-y divide-stone-100 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-stone-50">
                    <span className="font-medium">{inv.number ?? "ร่าง"}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums">{formatMoney(inv.total)}</span>
                      <DocumentStatusBadge status={inv.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <DocumentPaper doc={doc} items={items} />
    </div>
  );
}
