import path from "node:path";
import { Children, type ComponentProps, type ReactNode } from "react";
import { Document, Font, Image, Page, StyleSheet, Text as PdfText, View } from "@react-pdf/renderer";
import { bahtText } from "@/lib/bahttext";
import { docLabel } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments";
import type { ClientResponse, DocumentItem, DocumentRow, PartySnapshot, Payment } from "@/lib/types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(FONT_DIR, "Sarabun_400Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Sarabun_600SemiBold.ttf"), fontWeight: 600 },
  ],
});

// Thai has no spaces between words, so react-pdf can't wrap it on its own.
// Hand it word boundaries; the empty strings stop it inserting hyphens.
const thaiWords = new Intl.Segmenter("th", { granularity: "word" });
Font.registerHyphenationCallback((word) =>
  Array.from(thaiWords.segment(word), (s) => s.segment).flatMap((s) => [s, ""]),
);

// SARA AM (ำ) shapes into two glyphs (nikhahit + sara aa). react-pdf maps
// glyphs back to characters one-to-one, so every run containing ำ loses its
// last character. Decompose it up front; the nikhahit goes before a tone mark
// so น้ำ still stacks correctly.
export function fixThai(text: string) {
  return text.replace(/([่-๋])ำ/g, "ํ$1า").replace(/ำ/g, "ํา");
}

function fixChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => (typeof child === "string" ? fixThai(child) : child));
}

type PdfTextProps = Extract<ComponentProps<typeof PdfText>, { render?: unknown }>;

// Drop-in <Text> that applies fixThai to its string children and render().
function Text({ children, render, ...props }: PdfTextProps) {
  // react-pdf treats a present-but-undefined `render` prop as a render function.
  if (render) {
    return (
      <PdfText
        {...props}
        render={(args) => {
          const out = render(args);
          return typeof out === "string" ? fixThai(out) : out;
        }}
      />
    );
  }
  return <PdfText {...props}>{fixChildren(children)}</PdfText>;
}

const ink = "#1c1f1e";
const muted = "#6b6f6c";
const line = "#e4e4e0";

const s = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 10, color: ink, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.45 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8.5, color: muted, marginBottom: 2 },
  bold: { fontWeight: 600 },
  muted: { color: muted },
  // Sarabun draws taller than react-pdf's line box at large sizes, so the
  // title gets an explicit line height and room below it.
  title: { fontSize: 18, fontWeight: 600, textAlign: "right", lineHeight: 1.6, marginBottom: 2 },
  subtitle: { fontSize: 9, color: muted, textAlign: "right", letterSpacing: 1, lineHeight: 1.2 },
  docHead: { alignItems: "flex-end" },
  logo: { maxHeight: 48, maxWidth: 160, objectFit: "contain", objectPosition: "left", marginBottom: 8 },
  section: { borderBottomWidth: 1, borderBottomColor: line, paddingBottom: 14, marginBottom: 14 },
  th: { fontSize: 8.5, color: muted, fontWeight: 600, paddingVertical: 5 },
  td: { paddingVertical: 5 },
  num: { textAlign: "right" },
  totals: { width: 220, marginLeft: "auto" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontSize: 12, fontWeight: 600 },
  box: { borderWidth: 1, borderColor: line, borderRadius: 6, padding: 10, marginTop: 14, backgroundColor: "#fafaf8" },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 8, color: muted, flexDirection: "row", justifyContent: "space-between" },
  stamp: { position: "absolute", top: 300, left: 120, fontSize: 64, color: "#d33", opacity: 0.18, transform: "rotate(-24deg)", fontWeight: 600 },
});

// Column widths for the items table.
const col = { no: "5%", desc: "45%", qty: "12%", price: "13%", disc: "10%", amount: "15%" };

export interface PdfExtras {
  /** Number of the document this one references (quotation / invoice). */
  reference?: string | null;
  /** Receipt: the payment it settles. */
  payment?: Payment | null;
  /** Invoice: cash still to transfer, with an optional PromptPay QR (data URL). */
  /** Delivery notes: the client's sign-off or change request. */
  response?: ClientResponse | null;
  /** Seller logo from the snapshot, already downloaded. */
  logo?: { data: Buffer; format: "png" | "jpg" } | null;
  due?: { cashDue: number; paid: number; qr: string | null; promptpay: string | null; banks: { bank: string; account_no: string; account_name: string }[] } | null;
}

export function DocumentPdf({ doc, items, extras }: { doc: DocumentRow; items: DocumentItem[]; extras: PdfExtras }) {
  const meta = docLabel(doc);
  const hasWht = Number(doc.wht_amount) > 0;
  // Delivery notes list what is handed over; prices stay on the quotation.
  const priced = doc.type !== "delivery_note";

  return (
    <Document title={`${meta.label} ${doc.number}`} author={doc.seller_snapshot?.legal_name ?? undefined} creator="WorkNest" producer="WorkNest">
      <Page size="A4" style={s.page}>
        {doc.status === "void" && <Text style={s.stamp}>ยกเลิก</Text>}

        <View style={[s.between, s.section]}>
          <View style={{ maxWidth: 260 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {extras.logo && <Image src={extras.logo} style={s.logo} />}
            <Party label="ผู้ให้บริการ" party={doc.seller_snapshot} />
          </View>
          <View style={s.docHead}>
            <Text style={s.title}>{meta.label}</Text>
            <Text style={s.subtitle}>{meta.english}</Text>
            <View style={{ marginTop: 8 }}>
              <Meta label="เลขที่" value={doc.number ?? ""} strong />
              <Meta label="วันที่" value={formatDate(doc.issue_date)} />
              {doc.valid_until && <Meta label="ยืนราคาถึง" value={formatDate(doc.valid_until)} />}
              {doc.due_date && <Meta label="ครบกำหนด" value={formatDate(doc.due_date)} />}
              {extras.reference && <Meta label="อ้างอิง" value={extras.reference} />}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Party label="ลูกค้า" party={doc.buyer_snapshot} />
          {doc.title && (
            <Text style={{ marginTop: 8 }}>
              <Text style={s.muted}>งาน: </Text>
              <Text style={s.bold}>{doc.title}</Text>
            </Text>
          )}
        </View>

        {/* Items */}
        <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: "#c9c9c4" }]} fixed>
          <Text style={[s.th, { width: col.no }]}>#</Text>
          <Text style={[s.th, { width: priced ? col.desc : "83%" }]}>รายละเอียด</Text>
          <Text style={[s.th, s.num, { width: col.qty }]}>จำนวน</Text>
          {priced && (
            <>
              <Text style={[s.th, s.num, { width: col.price }]}>ราคา/หน่วย</Text>
              <Text style={[s.th, s.num, { width: col.disc }]}>ส่วนลด</Text>
              <Text style={[s.th, s.num, { width: col.amount }]}>จำนวนเงิน</Text>
            </>
          )}
        </View>
        {items.map((i, index) => (
          <View key={i.id} style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: line }]} wrap={false}>
            <Text style={[s.td, s.muted, { width: col.no }]}>{index + 1}</Text>
            <Text style={[s.td, { width: priced ? col.desc : "83%", paddingRight: 8 }]}>{i.description}</Text>
            <Text style={[s.td, s.num, { width: col.qty }]}>
              {Number(i.quantity).toLocaleString("th-TH")} {i.unit ?? ""}
            </Text>
            {priced && (
              <>
                <Text style={[s.td, s.num, { width: col.price }]}>{formatMoney(i.unit_price)}</Text>
                <Text style={[s.td, s.num, { width: col.disc }]}>{Number(i.discount_amount) ? formatMoney(i.discount_amount) : "-"}</Text>
                <Text style={[s.td, s.num, { width: col.amount }]}>{formatMoney(i.amount)}</Text>
              </>
            )}
          </View>
        ))}

        {/* Totals */}
        {priced && (
          <View style={[s.between, { marginTop: 12 }]} wrap={false}>
            <Text style={[s.muted, { width: 250, alignSelf: "flex-end" }]}>({bahtText(hasWht ? doc.amount_payable : doc.total)})</Text>
            <View style={s.totals}>
              <TotalRow label="รวมเป็นเงิน" value={doc.subtotal} />
              {Number(doc.discount_amount) > 0 && <TotalRow label="ส่วนลด" value={-Number(doc.discount_amount)} />}
              {Number(doc.vat_amount) > 0 && <TotalRow label={`ภาษีมูลค่าเพิ่ม ${Number(doc.vat_rate)}%`} value={doc.vat_amount} />}
              <TotalRow label="ยอดรวมทั้งสิ้น" value={doc.total} grand />
              {hasWht && (
                <>
                  <TotalRow label={`หัก ณ ที่จ่าย ${Number(doc.wht_rate)}%`} value={-Number(doc.wht_amount)} muted />
                  <TotalRow label="ยอดชำระสุทธิ" value={doc.amount_payable} grand />
                </>
              )}
            </View>
          </View>
        )}

        {extras.payment && (
          <View style={[s.box, s.between]} wrap={false}>
            <View>
              <Text style={s.bold}>รายละเอียดการรับชำระ</Text>
              <Text style={s.muted}>วันที่รับเงิน {formatDate(extras.payment.received_on)}</Text>
              <Text style={s.muted}>
                ช่องทาง {paymentMethodLabel[extras.payment.method]}
                {extras.payment.reference ? ` · ${extras.payment.reference}` : ""}
              </Text>
            </View>
            <View style={{ width: 200 }}>
              <TotalRow label="รับเป็นเงิน" value={extras.payment.cash_amount} />
              {Number(extras.payment.wht_amount) > 0 && <TotalRow label="ภาษีหัก ณ ที่จ่าย" value={extras.payment.wht_amount} muted />}
              <TotalRow label="รวมรับชำระ" value={Number(extras.payment.cash_amount) + Number(extras.payment.wht_amount)} grand />
            </View>
          </View>
        )}

        {extras.due && (
          <View style={[s.box, s.row, { alignItems: "center" }]} wrap={false}>
            {extras.due.qr && (
              <View style={{ alignItems: "center", marginRight: 14 }}>
                {/* react-pdf <Image> has no alt attribute; the label below names it. */}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={extras.due.qr} style={{ width: 92, height: 92 }} />
                <Text style={{ fontSize: 8, color: "#1a3f6f", fontWeight: 600 }}>PromptPay</Text>
              </View>
            )}
            <View>
              <Text style={s.bold}>ช่องทางการชำระเงิน</Text>
              <Text>
                ยอดที่ต้องโอน <Text style={[s.bold, { fontSize: 12 }]}>{formatMoney(extras.due.cashDue)}</Text> บาท
              </Text>
              {extras.due.paid > 0 && <Text style={s.muted}>(ชำระแล้ว {formatMoney(extras.due.paid)} บาท)</Text>}
              {extras.due.promptpay && <Text style={s.muted}>พร้อมเพย์: {extras.due.promptpay}</Text>}
              {extras.due.banks.map((b) => (
                <Text key={`${b.bank}-${b.account_no}`} style={s.muted}>
                  {b.bank} เลขที่ {b.account_no}
                  {b.account_name ? ` (${b.account_name})` : ""}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Terms doc={doc} />

        {(doc.type === "quotation" || doc.type === "receipt") && <Signatures type={doc.type} />}
        {doc.type === "delivery_note" && <DeliverySignOff doc={doc} response={extras.response ?? null} />}

        <View style={s.footer} fixed>
          <Text>
            {meta.label} {doc.number}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `หน้า ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Party({ label, party }: { label: string; party: PartySnapshot | null }) {
  if (!party) return null;
  const branch =
    party.tax_id && party.branch_code ? (party.branch_code === "00000" ? " (สำนักงานใหญ่)" : ` (สาขา ${party.branch_code})`) : "";
  return (
    <View style={{ width: 280 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.bold, { fontSize: 11 }]}>{party.legal_name ?? party.name}</Text>
      {party.address && <Text style={s.muted}>{party.address}</Text>}
      {party.tax_id && (
        <Text style={s.muted}>
          เลขประจำตัวผู้เสียภาษี {party.tax_id}
          {branch}
        </Text>
      )}
      {(party.phone || party.email) && <Text style={s.muted}>{[party.phone, party.email].filter(Boolean).join(" · ")}</Text>}
    </View>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[s.row, { justifyContent: "flex-end" }]}>
      <Text style={[s.muted, { width: 64, textAlign: "right", marginRight: 8 }]}>{label}</Text>
      {/* Fixed width so every value ends on the same right edge as the title. */}
      <Text style={[{ width: 92, textAlign: "right" }, strong ? s.bold : {}]}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value, grand, muted: isMuted }: { label: string; value: string | number; grand?: boolean; muted?: boolean }) {
  return (
    <View style={[s.totalRow, grand ? { borderTopWidth: 0.5, borderTopColor: line, marginTop: 2, paddingTop: 4 } : {}]}>
      <Text style={[grand ? s.grand : {}, isMuted ? s.muted : {}]}>{label}</Text>
      <Text style={[grand ? s.grand : {}, isMuted ? s.muted : {}]}>{formatMoney(value)}</Text>
    </View>
  );
}

function Terms({ doc }: { doc: DocumentRow }) {
  const sections: [string, string | null][] = [
    ["ขอบเขตงาน", doc.scope_of_work],
    ["สิ่งที่ไม่รวมในราคา", doc.exclusions],
    ["จำนวนรอบแก้ไข", doc.revisions_included != null ? `แก้ไขได้ ${doc.revisions_included} รอบ (รอบเพิ่มเติมคิดค่าบริการแยก)` : null],
    ["เงื่อนไขการชำระเงิน", doc.payment_terms],
    [doc.type === "delivery_note" ? "รายละเอียด / ลิงก์ไฟล์งาน" : "หมายเหตุ", doc.notes],
  ];
  const filled = sections.filter(([, body]) => body);
  if (filled.length === 0) return null;
  return (
    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: line, paddingTop: 10 }}>
      {filled.map(([title, body]) => (
        <View key={title} style={{ marginBottom: 6 }} wrap={false}>
          <Text style={s.bold}>{title}</Text>
          <Text style={s.muted}>{body}</Text>
        </View>
      ))}
    </View>
  );
}

// Signature lines, plus the online sign-off when the client answered in the portal.
function DeliverySignOff({ doc, response }: { doc: DocumentRow; response: ClientResponse | null }) {
  const answered = doc.status === "accepted" || doc.status === "rejected";
  return (
    <View style={{ marginTop: 28 }} wrap={false}>
      {answered && (
        <View style={[s.box, { marginTop: 0, marginBottom: 16 }]}>
          <Text style={s.bold}>
            {doc.status === "accepted" ? "ลูกค้าตรวจรับงานแล้ว" : "ลูกค้าขอแก้ไขงาน"} {formatDate(doc.responded_at)}
          </Text>
          {response?.actor_name && (
            <Text style={s.muted}>
              โดย {response.actor_name}
              {response.actor === "client" ? " (ยืนยันผ่านลิงก์ออนไลน์)" : ""}
            </Text>
          )}
          {response?.note && <Text style={s.muted}>“{response.note}”</Text>}
        </View>
      )}
      <View style={s.between}>
        {["ผู้ส่งมอบ", "ผู้ตรวจรับ (ลูกค้า)"].map((label) => (
          <View key={label} style={{ width: 200, alignItems: "center" }}>
            <View style={{ borderBottomWidth: 0.75, borderBottomColor: ink, width: 180, height: 28 }} />
            <Text style={{ marginTop: 4 }}>{label}</Text>
            <Text style={[s.muted, { fontSize: 8.5 }]}>วันที่ ........./........./.........</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Signatures({ type }: { type: "quotation" | "receipt" }) {
  const [left, right] = type === "quotation" ? ["ผู้เสนอราคา", "ผู้อนุมัติ (ลูกค้า)"] : ["ผู้รับเงิน", "ผู้จ่ายเงิน"];
  return (
    <View style={[s.between, { marginTop: 36 }]} wrap={false}>
      {[left, right].map((label) => (
        <View key={label} style={{ width: 200, alignItems: "center" }}>
          <View style={{ borderBottomWidth: 0.75, borderBottomColor: ink, width: 180, height: 28 }} />
          <Text style={{ marginTop: 4 }}>{label}</Text>
          <Text style={[s.muted, { fontSize: 8.5 }]}>วันที่ ........./........./.........</Text>
        </View>
      ))}
    </View>
  );
}

