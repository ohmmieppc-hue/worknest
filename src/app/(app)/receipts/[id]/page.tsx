import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DocumentActions } from "@/components/document-actions";
import { DocumentExport } from "@/components/document-export";
import { SharePanel } from "@/components/share-panel";
import { DocumentPaper, TotalRow, VoidNotice } from "@/components/document-paper";
import { loadDocument, loadShareLinks, loadDocumentNumber } from "@/lib/document-data";
import { formatDate } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments";
import type { Payment } from "@/lib/types";

export const metadata: Metadata = { title: "ใบเสร็จรับเงิน" };

export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  const { supabase, doc, items } = await loadDocument("receipt", id);
  const shareLinks = doc.status === "draft" ? [] : await loadShareLinks(doc.id);
  const [invoice, { data: paymentData }] = await Promise.all([
    loadDocumentNumber(doc.source_document_id),
    supabase.from("payments").select("*").eq("receipt_id", doc.id).maybeSingle(),
  ]);
  const payment = paymentData as Payment | null;

  return (
    <div>
      {/* Everything above the document itself is screen-only. */}
      <div className="print:hidden">
        {invoice && (
          <div className="mb-2 text-sm">
            <Link href={`/invoices/${invoice.id}`} className="text-stone-500 hover:text-stone-800">
              ← ใบแจ้งหนี้ {invoice.number}
            </Link>
          </div>
        )}
        <PageHeader title={`ใบเสร็จรับเงิน ${doc.number}`} actions={<DocumentStatusBadge status={doc.status} />} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          {doc.status !== "void" ? (
            <div>
              <DocumentActions type="receipt" id={doc.id} status={doc.status} />
              <p className="mt-2 text-xs text-stone-500">ยกเลิกใบเสร็จได้หากออกผิด แล้วออกใบใหม่จากหน้าใบแจ้งหนี้</p>
            </div>
          ) : (
            <span />
          )}
          <DocumentExport id={doc.id} />
        </div>

        <VoidNotice doc={doc} />

        {doc.status !== "void" && <SharePanel type="receipt" documentId={doc.id} links={shareLinks} />}
      </div>

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
    </div>
  );
}
