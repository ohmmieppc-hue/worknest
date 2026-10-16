import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { AmountRows, DocumentDetail, SidePanel } from "@/components/document-detail";
import { DocumentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { DocumentEditor } from "@/components/document-editor";
import { DocumentPaper, VoidNotice } from "@/components/document-paper";
import { PaymentInstructions } from "@/components/payment-instructions";
import { loadClientOptions, loadServiceOptions, loadDocument, loadShareLinks, loadDocumentNumber } from "@/lib/document-data";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { amountsDue } from "@/lib/payments";
import type { InvoiceBalance } from "@/lib/types";
import { PaymentPanel, type PaymentRow } from "./payment-panel";
import { DocumentHistory } from "@/components/document-history";
import { requireWorkspace } from "@/lib/workspace";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบแจ้งหนี้" };

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function InvoicePage(props: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoicePageContent {...props} />
    </Suspense>
  );
}

async function InvoicePageContent({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const { supabase, doc, items } = await loadDocument("invoice", id);
  const shareLinks = doc.status === "draft" ? [] : await loadShareLinks(doc.id);

  if (doc.status === "draft") {
    const [clients, services] = await Promise.all([loadClientOptions(doc.client_id), loadServiceOptions()]);
    const { workspace } = await requireWorkspace();
    return (
      <div>
        <PageHeader
          title="ใบแจ้งหนี้ (ร่าง)"
          description="เลขที่เอกสารจะถูกออกให้อัตโนมัติเมื่อกด “ออกใบแจ้งหนี้”"
          actions={<DocumentStatusBadge status={doc.status} />}
        />
        <DocumentEditor
          doc={{ ...doc, type: "invoice" }}
          items={items}
          clients={clients}
          services={services}
          vatRegistered={workspace.vat_registered}
        />
      </div>
    );
  }

  const [{ data: balanceData }, { data: paymentData }, source] = await Promise.all([
    supabase.from("invoice_balances").select("*").eq("invoice_id", doc.id).maybeSingle(),
    supabase
      .from("payments")
      .select("*, receipt:documents!payments_receipt_id_workspace_id_fkey(id, number, status)")
      .eq("invoice_id", doc.id)
      .order("received_on")
      .order("created_at"),
    loadDocumentNumber(doc.source_document_id),
  ]);
  const balance = balanceData as InvoiceBalance | null;
  const payments = (paymentData ?? []) as unknown as PaymentRow[];
  const due = balance ? amountsDue(doc, balance) : null;
  const live = doc.status !== "void";

  const client = doc.buyer_snapshot?.name ?? doc.buyer_snapshot?.legal_name;
  // Issued, unpaid and never sent: sending the link is the next step, then the payment.
  const unsent = doc.status === "issued" && !!due && due.outstanding > 0;
  const actionsPanel = (
    <SidePanel title="การดำเนินการ">
      <div className="p-4">
        <DocumentActions type="invoice" id={doc.id} status={doc.status} />
      </div>
    </SidePanel>
  );

  return (
    <DocumentDetail
      back={{ href: "/invoices", label: "ใบแจ้งหนี้ทั้งหมด" }}
      title={`ใบแจ้งหนี้ ${doc.number}`}
      badges={
        <>
          <DocumentStatusBadge status={doc.status} />
          {balance && live && <PaymentStatusBadge status={balance.payment_status} overdue={balance.is_overdue} />}
        </>
      }
      subtitle={[client, doc.title].filter(Boolean).join(" · ")}
      toolbar={<DocumentExport id={doc.id} />}
      notices={doc.status === "void" ? <VoidNotice doc={doc} /> : null}
      primary={
        <>
          {!live && actionsPanel}
          {unsent && <SharePanel type="invoice" documentId={doc.id} links={shareLinks} suggested />}
          {balance && live && (
            <SidePanel title="ยอดเงิน">
              <AmountRows
                rows={[
                  { label: "ยอดรวมทั้งสิ้น", value: formatMoney(balance.total) },
                  { label: "รับเงินแล้ว", value: formatMoney(balance.cash_received) },
                  ...(Number(balance.wht_withheld) > 0 ? [{ label: "ลูกค้าหัก ณ ที่จ่าย", value: formatMoney(balance.wht_withheld), tone: "muted" as const }] : []),
                  {
                    label: "คงค้าง",
                    value: formatMoney(balance.outstanding),
                    strong: true,
                    tone: balance.is_overdue ? ("danger" as const) : undefined,
                  },
                  { label: "ครบกำหนด", value: formatDate(doc.due_date), tone: balance.is_overdue ? ("danger" as const) : undefined },
                ]}
              />
            </SidePanel>
          )}
          {live && (
            <PaymentPanel
              invoiceId={doc.id}
              canRecord={!!due && due.outstanding > 0}
              payments={payments}
              defaults={{ cashDue: due?.cashDue ?? 0, whtDue: due?.whtDue ?? 0, today: todayISO() }}
              emphasize={!unsent}
            />
          )}
          {live && actionsPanel}
        </>
      }
      secondary={
        <>
          {live && !unsent && <SharePanel type="invoice" documentId={doc.id} links={shareLinks} />}
          <DocumentHistory documentId={doc.id} type="invoice" />
        </>
      }
    >
      <DocumentPaper
        doc={doc}
        items={items}
        reference={
          source ? (
            <Link href={`/quotations/${source.id}`} className="hover:underline">
              {source.number}
            </Link>
          ) : null
        }
      >
        {live && due && due.outstanding > 0 && <PaymentInstructions seller={doc.seller_snapshot} cashDue={due.cashDue} paid={Number(balance?.settled ?? 0)} />}
      </DocumentPaper>
    </DocumentDetail>
  );
}
