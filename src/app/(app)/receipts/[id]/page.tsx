import type { Metadata } from "next";
import Link from "next/link";
import { AmountRows, DocumentDetail, SidePanel } from "@/components/document-detail";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { DocumentPaper, TotalRow, VoidNotice } from "@/components/document-paper";
import { loadDocument, loadShareLinks, loadDocumentNumber } from "@/lib/document-data";
import { docLabel } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments";
import type { Payment } from "@/lib/types";
import { DocumentHistory } from "@/components/document-history";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบเสร็จรับเงิน" };

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function ReceiptPage(props: PageProps<"/receipts/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReceiptPageContent {...props} />
    </Suspense>
  );
}

async function ReceiptPageContent({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  const { supabase, doc, items } = await loadDocument("receipt", id);
  const shareLinks = doc.status === "draft" ? [] : await loadShareLinks(doc.id);
  const [invoice, { data: paymentData }] = await Promise.all([
    loadDocumentNumber(doc.source_document_id),
    supabase.from("payments").select("*").eq("receipt_id", doc.id).maybeSingle(),
  ]);
  const payment = paymentData as Payment | null;

  const client = doc.buyer_snapshot?.name ?? doc.buyer_snapshot?.legal_name;

  return (
    <DocumentDetail
      back={invoice ? { href: `/invoices/${invoice.id}`, label: `ใบแจ้งหนี้ ${invoice.number}` } : { href: "/receipts", label: "ใบเสร็จทั้งหมด" }}
      title={`${docLabel(doc).label} ${doc.number}`}
      badges={<DocumentStatusBadge status={doc.status} />}
      subtitle={[client, doc.title].filter(Boolean).join(" · ")}
      toolbar={<DocumentExport id={doc.id} />}
      notices={doc.status === "void" ? <VoidNotice doc={doc} /> : null}
      primary={
        <>
          {payment && (
            <SidePanel title="การรับชำระ">
              <AmountRows
                rows={[
                  { label: "วันที่รับเงิน", value: formatDate(payment.received_on) },
                  { label: "ช่องทาง", value: paymentMethodLabel[payment.method] },
                  { label: "รับเป็นเงิน", value: formatMoney(payment.cash_amount) },
                  ...(Number(payment.wht_amount) > 0 ? [{ label: "ภาษีหัก ณ ที่จ่าย", value: formatMoney(payment.wht_amount), tone: "muted" as const }] : []),
                  { label: "รวมรับชำระ", value: formatMoney(Number(payment.cash_amount) + Number(payment.wht_amount)), strong: true },
                ]}
              />
            </SidePanel>
          )}
          {doc.status !== "void" && (
            <SidePanel title="การดำเนินการ">
              <div className="p-4">
                <DocumentActions type="receipt" id={doc.id} status={doc.status} />
                <p className="mt-2 text-xs text-stone-500">ยกเลิกใบเสร็จได้หากออกผิด แล้วออกใบใหม่จากหน้าใบแจ้งหนี้</p>
              </div>
            </SidePanel>
          )}
        </>
      }
      secondary={
        <>
          {doc.status !== "void" && <SharePanel type="receipt" documentId={doc.id} links={shareLinks} />}
          <DocumentHistory documentId={doc.id} type="receipt" />
        </>
      }
    >
      <DocumentPaper
        doc={doc}
        items={items}
        reference={invoice ? <Link href={`/invoices/${invoice.id}`} className="hover:underline">{invoice.number}</Link> : null}
      >
        {payment && (
          <div className="mt-6 flex flex-wrap justify-between gap-6 rounded-xl border border-stone-200 bg-stone-50/70 p-5 text-sm">
            <div className="space-y-1">
              <p className="font-semibold">รายละเอียดการรับชำระ</p>
              <p className="text-stone-600">วันที่รับเงิน {formatDate(payment.received_on)}</p>
              <p className="text-stone-600">
                ช่องทาง {paymentMethodLabel[payment.method]}
                {payment.reference && ` · ${payment.reference}`}
              </p>
            </div>
            <dl className="w-full max-w-xs space-y-1.5">
              <TotalRow label="รับเป็นเงิน" value={payment.cash_amount} />
              {Number(payment.wht_amount) > 0 && <TotalRow label="ภาษีหัก ณ ที่จ่าย" value={payment.wht_amount} muted />}
              <TotalRow label="รวมรับชำระ" value={Number(payment.cash_amount) + Number(payment.wht_amount)} strong />
            </dl>
          </div>
        )}
      </DocumentPaper>
    </DocumentDetail>
  );
}
