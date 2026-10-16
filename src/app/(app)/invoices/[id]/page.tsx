import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { DocumentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { DocumentEditor } from "@/components/document-editor";
import { DocumentPaper, VoidNotice } from "@/components/document-paper";
import { PaymentInstructions } from "@/components/payment-instructions";
import { loadClientOptions, loadServiceOptions, loadDocument, loadShareLinks, loadDocumentNumber } from "@/lib/document-data";
import { formatMoney, todayISO } from "@/lib/format";
import { amountsDue } from "@/lib/payments";
import type { InvoiceBalance } from "@/lib/types";
import { PaymentPanel, type PaymentRow } from "./payment-panel";
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
    return (
      <div>
        <PageHeader
          title="ใบแจ้งหนี้ (ร่าง)"
          description="เลขที่เอกสารจะถูกออกให้อัตโนมัติเมื่อกด “ออกใบแจ้งหนี้”"
          actions={<DocumentStatusBadge status={doc.status} />}
        />
        <DocumentEditor doc={{ ...doc, type: "invoice" }} items={items} clients={clients} services={services} />
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

  return (
    <div>
      {/* Everything above the document itself is screen-only. */}
      <div className="print:hidden">
        <div className="mb-2 text-sm">
          <Link href="/invoices" className="text-stone-500 hover:text-stone-800">
            ← ใบแจ้งหนี้ทั้งหมด
          </Link>
        </div>
        <PageHeader
          title={`ใบแจ้งหนี้ ${doc.number}`}
          actions={
            <div className="flex gap-2">
              <DocumentStatusBadge status={doc.status} />
              {balance && live && <PaymentStatusBadge status={balance.payment_status} overdue={balance.is_overdue} />}
            </div>
          }
        />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <DocumentActions type="invoice" id={doc.id} status={doc.status} />
          <DocumentExport id={doc.id} />
        </div>

        <VoidNotice doc={doc} />

        {doc.status !== "void" && <SharePanel type="invoice" documentId={doc.id} links={shareLinks} />}

        {balance && live && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="ยอดรวมทั้งสิ้น" value={balance.total} />
            <Stat label="รับเงินแล้ว" value={balance.cash_received} />
            <Stat label="ลูกค้าหัก ณ ที่จ่าย" value={balance.wht_withheld} />
            <Stat label="คงค้าง" value={balance.outstanding} highlight={Number(balance.outstanding) > 0} />
          </div>
        )}

        {live && (
          <PaymentPanel
            invoiceId={doc.id}
            canRecord={!!due && due.outstanding > 0}
            payments={payments}
            defaults={{ cashDue: due?.cashDue ?? 0, whtDue: due?.whtDue ?? 0, today: todayISO() }}
          />
        )}
      </div>

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
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? "border-amber-200 bg-amber-50/50" : ""}`}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(value)}</p>
    </Card>
  );
}
