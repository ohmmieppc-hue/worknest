import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DocumentEditor } from "@/components/document-editor";
import { DocumentPaper, VoidNotice } from "@/components/document-paper";
import {
  loadClientOptions,
  loadClientResponse,
  loadDocument,
  loadDocumentNumber,
  loadServiceOptions,
  loadShareLinks,
} from "@/lib/document-data";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบส่งมอบงาน" };

// The Suspense boundary lives inside the page so client navigations into this
// route can show the skeleton instantly.
export default function DeliveryNotePage(props: PageProps<"/delivery-notes/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeliveryNotePageContent {...props} />
    </Suspense>
  );
}

async function DeliveryNotePageContent({ params }: PageProps<"/delivery-notes/[id]">) {
  const { id } = await params;
  const { supabase, doc, items } = await loadDocument("delivery_note", id);
  const quotation = await loadDocumentNumber(doc.source_document_id);
  const quotationLink = quotation && (
    <Link href={`/quotations/${quotation.id}`} className="hover:text-brand-700 hover:underline">
      ใบเสนอราคา {quotation.number}
    </Link>
  );

  if (doc.status === "draft") {
    const [clients, services] = await Promise.all([loadClientOptions(doc.client_id), loadServiceOptions()]);
    return (
      <div>
        <PageHeader
          title="ใบส่งมอบงาน (ร่าง)"
          description="ระบุงานที่ส่งมอบและลิงก์ไฟล์ เมื่อออกเอกสารแล้วส่งลิงก์ให้ลูกค้าตรวจรับหรือขอแก้ไขได้"
          actions={<DocumentStatusBadge status={doc.status} type="delivery_note" />}
        />
        {quotationLink && <p className="-mt-3 mb-4 text-sm text-stone-500">ส่งมอบตาม{quotationLink}</p>}
        <DocumentEditor doc={{ ...doc, type: "delivery_note" }} items={items} clients={clients} services={services} />
      </div>
    );
  }

  const [shareLinks, response] = await Promise.all([loadShareLinks(doc.id), loadClientResponse(supabase, doc)]);

  return (
    <div>
      <div className="print:hidden">
        <div className="mb-2 text-sm">
          <Link href="/delivery-notes" className="text-stone-500 hover:text-stone-800">
            ← ใบส่งมอบงานทั้งหมด
          </Link>
        </div>
        <PageHeader
          title={`ใบส่งมอบงาน ${doc.number}`}
          description={quotation ? `ส่งมอบตามใบเสนอราคา ${quotation.number}` : undefined}
          actions={<DocumentStatusBadge status={doc.status} type="delivery_note" />}
        />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <DocumentActions type="delivery_note" id={doc.id} status={doc.status} />
          <DocumentExport id={doc.id} />
        </div>

        <VoidNotice doc={doc} />

        {doc.status === "rejected" && (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            ลูกค้าขอแก้ไข{response?.note ? `: “${response.note}”` : ""} — แก้งานแล้วกด “คัดลอกเป็นฉบับใหม่” เพื่อส่งมอบรอบถัดไป
            {quotation && " (นับเป็นรอบแก้ไขในใบเสนอราคาแล้ว)"}
          </p>
        )}

        {doc.status !== "void" && <SharePanel type="delivery_note" documentId={doc.id} links={shareLinks} />}
      </div>

      <DocumentPaper doc={doc} items={items} reference={quotation?.number} response={response} />
    </div>
  );
}
