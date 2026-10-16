import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { AmountRows, DocumentDetail, SidePanel } from "@/components/document-detail";
import { LinkedList } from "@/components/linked-list";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DocumentEditor } from "@/components/document-editor";
import { DocumentPaper, VoidNotice } from "@/components/document-paper";
import { loadClientOptions, loadServiceOptions, loadDocument, loadShareLinks } from "@/lib/document-data";
import { formatDate, formatMoney } from "@/lib/format";
import type { DocumentRevision, DocumentRow } from "@/lib/types";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { DocumentHistory } from "@/components/document-history";
import { requireWorkspace } from "@/lib/workspace";
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
    const { workspace } = await requireWorkspace();
    return (
      <div>
        <PageHeader
          title="ใบเสนอราคา (ร่าง)"
          description="เลขที่เอกสารจะถูกออกให้อัตโนมัติเมื่อกด “ออกใบเสนอราคา”"
          actions={<DocumentStatusBadge status={doc.status} />}
        />
        <DocumentEditor
          doc={{ ...doc, type: "quotation" }}
          items={items}
          clients={clients}
          services={services}
          vatRegistered={workspace.vat_registered}
        />
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

  const client = doc.buyer_snapshot?.name ?? doc.buyer_snapshot?.legal_name;
  // Issued but never sent: sending the link is the next step.
  const unsent = doc.status === "issued";

  return (
    <DocumentDetail
      back={{ href: "/quotations", label: "ใบเสนอราคาทั้งหมด" }}
      title={`ใบเสนอราคา ${doc.number}`}
      badges={<DocumentStatusBadge status={doc.status} />}
      subtitle={[client, doc.title].filter(Boolean).join(" · ")}
      toolbar={<DocumentExport id={doc.id} />}
      notices={doc.status === "void" ? <VoidNotice doc={doc} /> : null}
      primary={
        <>
          {unsent && <SharePanel type="quotation" documentId={doc.id} links={shareLinks} suggested />}
          <SidePanel title="การดำเนินการ">
            <div className="p-4">
              <DocumentActions
                type="quotation"
                id={doc.id}
                status={doc.status}
                hint={doc.status === "sent" || doc.status === "viewed" ? "รอลูกค้าตอบรับผ่านลิงก์ ระบบจะแจ้งเมื่อลูกค้าตอบ" : undefined}
              />
            </div>
          </SidePanel>
          <SidePanel title="สรุป">
            <AmountRows
              rows={[
                { label: "ยอดรวมทั้งสิ้น", value: formatMoney(doc.total) },
                ...(Number(doc.wht_amount) > 0 ? [{ label: "ยอดชำระสุทธิ", value: formatMoney(doc.amount_payable), strong: true }] : []),
                { label: "ยืนราคาถึง", value: formatDate(doc.valid_until) },
                ...(doc.responded_at ? [{ label: "ลูกค้าตอบเมื่อ", value: formatDate(doc.responded_at) }] : []),
              ]}
            />
          </SidePanel>
          {(doc.status === "accepted" || revisions.length > 0) && (
            <RevisionPanel quotationId={doc.id} included={doc.revisions_included} revisions={revisions} canLog={doc.status === "accepted"} />
          )}
        </>
      }
      secondary={
        <>
          {doc.status !== "void" && !unsent && <SharePanel type="quotation" documentId={doc.id} links={shareLinks} />}
          {invoices.length > 0 && (
            <SidePanel title="ใบแจ้งหนี้จากใบเสนอราคานี้">
              <LinkedList
                rows={invoices.map((inv) => ({
                  href: `/invoices/${inv.id}`,
                  label: inv.number ?? "ร่าง",
                  amount: formatMoney(inv.total),
                  badge: <DocumentStatusBadge status={inv.status} />,
                }))}
              />
            </SidePanel>
          )}
          {deliveries.length > 0 && (
            <SidePanel title="ใบส่งมอบงาน">
              <LinkedList
                rows={deliveries.map((dn) => ({
                  href: `/delivery-notes/${dn.id}`,
                  label: dn.number ?? "ร่าง",
                  badge: <DocumentStatusBadge status={dn.status} type="delivery_note" />,
                }))}
              />
            </SidePanel>
          )}
          <DocumentHistory documentId={doc.id} type="quotation" />
        </>
      }
    >
      <DocumentPaper doc={doc} items={items} />
    </DocumentDetail>
  );
}
