import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DocumentEditor } from "@/components/document-editor";
import { DocumentPaper, VoidNotice } from "@/components/document-paper";
import { loadClientOptions, loadServiceOptions, loadDocument, loadShareLinks } from "@/lib/document-data";
import { formatMoney } from "@/lib/format";
import type { DocumentRevision, DocumentRow } from "@/lib/types";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { RevisionPanel } from "./revision-panel";

export const metadata: Metadata = { title: "ใบเสนอราคา" };

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function QuotationPage(props: PageProps<"/quotations/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuotationPageContent {...props} />
    </Suspense>
  );
}

async function QuotationPageContent({ params }: PageProps<"/quotations/[id]">) {
  const { id } = await params;
  const { supabase, doc, items } = await loadDocument("quotation", id);
  const shareLinks = doc.status === "draft" ? [] : await loadShareLinks(doc.id);

  if (doc.status === "draft") {
    const [clients, services] = await Promise.all([loadClientOptions(doc.client_id), loadServiceOptions()]);
    return (
      <div>
        <PageHeader
          title="ใบเสนอราคา (ร่าง)"
          description="เลขที่เอกสารจะถูกออกให้อัตโนมัติเมื่อกด “ออกใบเสนอราคา”"
          actions={<DocumentStatusBadge status={doc.status} />}
        />
        <DocumentEditor doc={{ ...doc, type: "quotation" }} items={items} clients={clients} services={services} />
      </div>
    );
  }

  const [{ data: invoiceData }, { data: revisionData }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, number, status, total")
      .in("type", ["invoice", "delivery_note"])
      .eq("source_document_id", doc.id)
      .order("created_at"),
    supabase.from("document_revisions").select("id, note, requested_by, created_at").eq("document_id", doc.id).order("created_at"),
  ]);
  const revisions = (revisionData ?? []) as DocumentRevision[];
  const linked = (invoiceData ?? []) as Pick<DocumentRow, "id" | "type" | "number" | "status" | "total">[];
  const invoices = linked.filter((d) => d.type === "invoice");
  const deliveries = linked.filter((d) => d.type === "delivery_note");

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

        {(doc.status === "accepted" || revisions.length > 0) && (
          <RevisionPanel
            quotationId={doc.id}
            included={doc.revisions_included}
            revisions={revisions}
            canLog={doc.status === "accepted"}
          />
        )}

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

        {deliveries.length > 0 && (
          <Card className="mb-6 overflow-hidden">
            <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold">ใบส่งมอบงาน</h2>
            <ul className="divide-y divide-stone-100 text-sm">
              {deliveries.map((dn) => (
                <li key={dn.id}>
                  <Link href={`/delivery-notes/${dn.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-stone-50">
                    <span className="font-medium">{dn.number ?? "ร่าง"}</span>
                    <DocumentStatusBadge status={dn.status} type="delivery_note" />
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
