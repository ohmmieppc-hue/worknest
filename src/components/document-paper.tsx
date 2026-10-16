import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { bahtText } from "@/lib/bahttext";
import { DOC_META } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import type { ClientResponse, DocumentItem, DocumentRow, PartySnapshot } from "@/lib/types";

interface Props {
  doc: DocumentRow;
  items: DocumentItem[];
  /** e.g. the quotation an invoice bills, or the invoice a receipt settles */
  reference?: ReactNode;
  /** Rendered under the totals (payment details, receipt breakdown…) */
  children?: ReactNode;
  /** Delivery notes: the client's sign-off or change request. */
  response?: ClientResponse | null;
}

// Read-only rendering of an issued document, built only from its snapshots so
// later edits to the client or workspace never change it.
export function DocumentPaper({ doc, items, reference, children, response }: Props) {
  const meta = DOC_META[doc.type];
  // Delivery notes list what is handed over; prices stay on the quotation.
  const priced = doc.type !== "delivery_note";
  const hasWht = Number(doc.wht_amount) > 0;
  const logo = logoUrl(doc.seller_snapshot?.logo_path);

  return (
    <Card className="relative p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
      {doc.status === "void" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 text-7xl font-bold text-red-600/15 select-none"
        >
          ยกเลิก
        </span>
      )}
      <div className="flex flex-wrap justify-between gap-6 border-b border-stone-200 pb-6">
        <div>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- public storage URL
            <img src={logo} alt="" className="mb-3 max-h-14 max-w-44 object-contain" />
          )}
          <Party title="ผู้ให้บริการ" party={doc.seller_snapshot} />
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{meta.label}</p>
          <p className="text-sm text-stone-500">{meta.english}</p>
          <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-sm">
            <dt className="text-stone-500">เลขที่</dt>
            <dd className="font-medium">{doc.number}</dd>
            <dt className="text-stone-500">วันที่</dt>
            <dd>{formatDate(doc.issue_date)}</dd>
            {doc.valid_until && (
              <>
                <dt className="text-stone-500">ยืนราคาถึง</dt>
                <dd>{formatDate(doc.valid_until)}</dd>
              </>
            )}
            {doc.due_date && (
              <>
                <dt className="text-stone-500">ครบกำหนด</dt>
                <dd>{formatDate(doc.due_date)}</dd>
              </>
            )}
            {reference && (
              <>
                <dt className="text-stone-500">อ้างอิง</dt>
                <dd>{reference}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="border-b border-stone-200 py-6">
        <Party title="ลูกค้า" party={doc.buyer_snapshot} />
        {doc.title && (
          <p className="mt-4 text-sm">
            <span className="text-stone-500">งาน: </span>
            <span className="font-medium">{doc.title}</span>
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className={`mt-6 w-full text-sm ${priced ? "min-w-[560px]" : ""}`}>
          <thead className="border-b border-stone-300 text-left text-xs text-stone-500">
            <tr>
              <th className="w-8 py-2 font-medium">#</th>
              <th className="py-2 font-medium">รายละเอียด</th>
              <th className="py-2 text-right font-medium">จำนวน</th>
              {priced && (
                <>
                  <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2 text-right font-medium">ส่วนลด</th>
                  <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((i, index) => (
              <tr key={i.id} className="align-top">
                <td className="py-2.5 text-stone-400">{index + 1}</td>
                <td className="py-2.5 whitespace-pre-line">{i.description}</td>
                <td className="py-2.5 text-right whitespace-nowrap tabular-nums">
                  {Number(i.quantity).toLocaleString("th-TH")} {i.unit}
                </td>
                {priced && (
                  <>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(i.unit_price)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {Number(i.discount_amount) ? formatMoney(i.discount_amount) : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(i.amount)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {priced && (
        <div className="mt-6 flex flex-wrap justify-between gap-6 border-t border-stone-200 pt-6">
          <p className="max-w-sm self-end text-sm text-stone-600">({bahtText(hasWht ? doc.amount_payable : doc.total)})</p>
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <TotalRow label="รวมเป็นเงิน" value={doc.subtotal} />
            {Number(doc.discount_amount) > 0 && <TotalRow label="ส่วนลด" value={-Number(doc.discount_amount)} />}
            {Number(doc.vat_amount) > 0 && <TotalRow label={`ภาษีมูลค่าเพิ่ม ${Number(doc.vat_rate)}%`} value={doc.vat_amount} />}
            <TotalRow label="ยอดรวมทั้งสิ้น" value={doc.total} strong />
            {hasWht && (
              <>
                <TotalRow label={`หัก ณ ที่จ่าย ${Number(doc.wht_rate)}%`} value={-Number(doc.wht_amount)} muted />
                <TotalRow label="ยอดชำระสุทธิ" value={doc.amount_payable} strong />
              </>
            )}
          </dl>
        </div>
      )}

      {children}

      {(doc.scope_of_work || doc.exclusions || doc.revisions_included != null || doc.payment_terms || doc.notes) && (
        <div className="mt-8 grid gap-5 border-t border-stone-200 pt-6 text-sm sm:grid-cols-2">
          <Section title="ขอบเขตงาน" body={doc.scope_of_work} />
          <Section title="สิ่งที่ไม่รวมในราคา" body={doc.exclusions} />
          <Section
            title="จำนวนรอบแก้ไข"
            body={doc.revisions_included != null ? `แก้ไขได้ ${doc.revisions_included} รอบ (รอบเพิ่มเติมคิดค่าบริการแยก)` : null}
          />
          <Section title="เงื่อนไขการชำระเงิน" body={doc.payment_terms} />
          <Section title={priced ? "หมายเหตุ" : "รายละเอียด / ลิงก์ไฟล์งาน"} body={doc.notes} />
        </div>
      )}

      {!priced && <SignOff doc={doc} response={response ?? null} />}
    </Card>
  );
}

function Party({ title, party }: { title: string; party: PartySnapshot | null }) {
  if (!party) return null;
  const name = party.legal_name ?? party.name;
  const branch =
    party.tax_id && party.branch_code
      ? party.branch_code === "00000"
        ? " (สำนักงานใหญ่)"
        : ` (สาขา ${party.branch_code})`
      : "";
  return (
    <div className="max-w-sm text-sm">
      <p className="mb-1 text-xs font-medium text-stone-500">{title}</p>
      <p className="font-semibold">{name}</p>
      {party.address && <p className="whitespace-pre-line text-stone-600">{party.address}</p>}
      {party.tax_id && (
        <p className="text-stone-600">
          เลขประจำตัวผู้เสียภาษี {party.tax_id}
          {branch}
        </p>
      )}
      {(party.phone || party.email) && <p className="text-stone-600">{[party.phone, party.email].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

export function TotalRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""} ${muted ? "text-stone-500" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

// Hand-over and sign-off lines; the client's side fills in from the portal.
function SignOff({ doc, response }: { doc: DocumentRow; response: ClientResponse | null }) {
  const signed = doc.status === "accepted";
  return (
    <div className="mt-8 grid gap-6 border-t border-stone-200 pt-6 text-sm sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-medium text-stone-500">ผู้ส่งมอบ</p>
        <p className="font-medium">{doc.seller_snapshot?.legal_name}</p>
        <p className="text-stone-600">วันที่ {formatDate(doc.issue_date)}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-stone-500">ผู้ตรวจรับ</p>
        {signed ? (
          <>
            <p className="font-medium">{response?.actor_name ?? doc.buyer_snapshot?.name}</p>
            <p className="text-emerald-700">
              ตรวจรับแล้ว {formatDate(doc.responded_at)}
              {response?.actor === "client" && " ผ่านลิงก์ออนไลน์"}
            </p>
          </>
        ) : doc.status === "rejected" ? (
          <>
            <p className="font-medium">{response?.actor_name ?? doc.buyer_snapshot?.name}</p>
            <p className="text-amber-700">ขอแก้ไข {formatDate(doc.responded_at)}</p>
            {response?.note && <p className="mt-1 whitespace-pre-line text-stone-600">“{response.note}”</p>}
          </>
        ) : (
          <p className="text-stone-500">รอลูกค้าตรวจรับ</p>
        )}
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <p className="whitespace-pre-line text-stone-600">{body}</p>
    </div>
  );
}

export function VoidNotice({ doc }: { doc: DocumentRow }) {
  if (doc.status !== "void") return null;
  return (
    <p className="mb-6 rounded-lg border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-700">
      ยกเลิกเมื่อ {formatDate(doc.voided_at)} — {doc.void_reason}
    </p>
  );
}
