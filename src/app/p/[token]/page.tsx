import type { Metadata } from "next";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { buttonClass, Card } from "@/components/ui";
import { DocumentPaper, TotalRow } from "@/components/document-paper";
import { PaymentInstructions } from "@/components/payment-instructions";
import { docLabel } from "@/lib/documents";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { RevisionCounter, RevisionList } from "@/components/revisions";
import { amountsDue, paymentMethodLabel } from "@/lib/payments";
import { notifyClientEvent } from "@/lib/notify";
import { getPortalDocument, requestMeta } from "@/lib/portal";
import { RespondForm } from "./respond-form";

export const metadata: Metadata = {
  title: "เอกสารจากผู้ให้บริการ",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PortalPage({ params }: PageProps<"/p/[token]">) {
  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <Suspense fallback={<div className="mx-auto mt-16 h-96 max-w-4xl animate-pulse rounded-xl bg-white" />}>
        <Portal params={params} />
      </Suspense>
    </div>
  );
}

async function Portal({ params }: Pick<PageProps<"/p/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const { supabase, data } = await getPortalDocument(token);
  if (!supabase || !data) return <InvalidLink />;

  const doc = data.document;
  const meta = docLabel(doc);

  // The owner previewing their own link shouldn't count as the client viewing it.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user ? !!(await supabase.from("documents").select("id").eq("id", doc.id).maybeSingle()).data : false;
  if (!isOwner) {
    const { ip, userAgent } = await requestMeta();
    const { data: firstView } = await supabase.rpc("portal_record_view", { p_token: token, p_ip: ip, p_user_agent: userAgent });
    // Email the owner after the page has been sent, so the client never waits on it.
    if (firstView === true) after(() => notifyClientEvent(doc.id, "viewed"));
  }

  const due = doc.type === "invoice" && data.balance ? amountsDue(doc, data.balance) : null;
  const expired = doc.type === "quotation" && (doc.status === "expired" || (!!doc.valid_until && doc.valid_until < todayISO()));
  const isDelivery = doc.type === "delivery_note";
  const canRespond = (doc.type === "quotation" || isDelivery) && ["issued", "sent", "viewed"].includes(doc.status) && !expired;
  const sellerName = doc.seller_snapshot?.legal_name ?? "";
  const sellerLogo = logoUrl(doc.seller_snapshot?.logo_path);

  return (
    <>
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {sellerLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- public storage URL
              <img src={sellerLogo} alt="" className="max-h-10 max-w-24 object-contain" />
            )}
            <div>
              <p className="font-semibold">{sellerName}</p>
              <p className="text-xs text-stone-500">
                {meta.label} {doc.number}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={`/p/${token}/pdf?download=1`} className={buttonClass("secondary")} download>
              ดาวน์โหลด PDF
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 print:p-0">
        <div className="print:hidden">
          {isOwner && (
            <Banner tone="info">นี่คือหน้าที่ลูกค้าจะเห็น (คุณเปิดในฐานะเจ้าของเอกสาร ระบบจึงไม่บันทึกว่าลูกค้าเปิดดู)</Banner>
          )}
          {doc.status === "void" && <Banner tone="danger">เอกสารนี้ถูกยกเลิกแล้ว กรุณาติดต่อผู้ให้บริการ</Banner>}
          {doc.type === "quotation" && doc.status === "accepted" && (
            <Banner tone="success">ตอบรับใบเสนอราคาแล้วเมื่อ {formatDate(doc.responded_at)} ขอบคุณครับ</Banner>
          )}
          {doc.type === "quotation" && doc.status === "rejected" && <Banner tone="muted">ใบเสนอราคานี้ได้รับการปฏิเสธแล้ว</Banner>}
          {isDelivery && doc.status === "accepted" && (
            <Banner tone="success">ตรวจรับงานแล้วเมื่อ {formatDate(doc.responded_at)} ขอบคุณครับ</Banner>
          )}
          {isDelivery && doc.status === "rejected" && (
            <Banner tone="info">ส่งคำขอแก้ไขแล้ว ผู้ให้บริการจะแก้งานและส่งใบส่งมอบงานฉบับใหม่ให้ตรวจอีกครั้ง</Banner>
          )}
          {expired && doc.status !== "accepted" && doc.status !== "rejected" && (
            <Banner tone="warning">ใบเสนอราคานี้หมดอายุแล้ว (ยืนราคาถึง {formatDate(doc.valid_until)}) กรุณาติดต่อผู้ให้บริการ</Banner>
          )}
          {doc.type === "invoice" && doc.status !== "void" && data.balance?.payment_status === "paid" && (
            <Banner tone="success">ชำระครบแล้ว ขอบคุณครับ</Banner>
          )}
        </div>

        <DocumentPaper doc={doc} items={data.items} reference={data.reference} response={data.response} schedule={data.schedule}>
          {due && doc.status !== "void" && due.outstanding > 0 && (
            <PaymentInstructions seller={doc.seller_snapshot} cashDue={due.cashDue} paid={Number(data.balance?.settled ?? 0)} />
          )}
          {data.payment && (
            <div className="mt-6 flex flex-wrap justify-between gap-6 rounded-xl border border-stone-200 bg-stone-50/70 p-5 text-sm">
              <div className="space-y-1">
                <p className="font-semibold">รายละเอียดการรับชำระ</p>
                <p className="text-stone-600">วันที่รับเงิน {formatDate(data.payment.received_on)}</p>
                <p className="text-stone-600">ช่องทาง {paymentMethodLabel[data.payment.method]}</p>
              </div>
              <dl className="w-full max-w-xs space-y-1.5">
                <TotalRow label="รับเป็นเงิน" value={data.payment.cash_amount} />
                {Number(data.payment.wht_amount) > 0 && <TotalRow label="ภาษีหัก ณ ที่จ่าย" value={data.payment.wht_amount} muted />}
                <TotalRow label="รวมรับชำระ" value={Number(data.payment.cash_amount) + Number(data.payment.wht_amount)} strong />
              </dl>
            </div>
          )}
        </DocumentPaper>

        {doc.type === "quotation" && doc.status === "accepted" && data.revisions && (
          <Card className="mt-6 p-6 print:hidden">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">รอบแก้ไขที่ใช้ไป</h2>
              <RevisionCounter used={data.revisions.length} included={doc.revisions_included} />
            </div>
            {data.revisions.length === 0 ? (
              <p className="text-sm text-stone-500">ยังไม่ได้ใช้รอบแก้ไข</p>
            ) : (
              <RevisionList revisions={data.revisions} />
            )}
          </Card>
        )}

        {canRespond && (
          <Card className="mt-6 p-6 print:hidden">
            {isDelivery ? (
              <>
                <h2 className="text-lg font-semibold">ตรวจรับงาน</h2>
                <p className="mb-4 text-sm text-stone-500">ตรวจสอบงานตามรายการด้านบน แล้วกดตรวจรับ หรือแจ้งสิ่งที่ต้องการให้แก้ไข</p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">ตอบรับใบเสนอราคา</h2>
                <p className="mb-4 text-sm text-stone-500">
                  ยอดรวม {formatMoney(doc.total)} บาท · ยืนราคาถึง {formatDate(doc.valid_until)}
                </p>
              </>
            )}
            <RespondForm token={token} kind={isDelivery ? "delivery_note" : "quotation"} />
          </Card>
        )}

        <p className="mt-8 text-center text-xs text-stone-400 print:hidden">
          ส่งผ่าน Work<span className="text-brand-600">Nest</span>
        </p>
      </main>
    </>
  );
}

function Banner({ tone, children }: { tone: "success" | "warning" | "danger" | "muted" | "info"; children: React.ReactNode }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    muted: "border-stone-200 bg-stone-100 text-stone-700",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  };
  return <p className={`mb-4 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</p>;
}

function InvalidLink() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-lg font-semibold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</p>
      <p className="mt-2 text-sm text-stone-500">กรุณาติดต่อผู้ส่งเอกสารเพื่อขอลิงก์ใหม่</p>
    </main>
  );
}
