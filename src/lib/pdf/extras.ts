import QRCode from "qrcode";
import { amountsDue } from "@/lib/payments";
import { logoUrl, sniffImageType } from "@/lib/logo";
import { promptPayPayload } from "@/lib/promptpay";
import type { ClientResponse, DocumentRow, InvoiceBalance, Payment, ScheduleRow } from "@/lib/types";
import type { PdfExtras } from "./document-pdf";

type SellerWithPayment = NonNullable<DocumentRow["seller_snapshot"]> & {
  promptpay_id?: string | null;
  bank_accounts?: { bank: string; account_no: string; account_name: string }[];
};

// Everything the PDF shows besides the document itself; shared by the owner's
// PDF route and the client portal.
export async function buildPdfExtras({
  doc,
  balance,
  payment,
  reference,
  response = null,
  schedule = null,
}: {
  doc: DocumentRow;
  balance: Pick<InvoiceBalance, "outstanding" | "wht_withheld" | "settled"> | null;
  payment: Pick<Payment, "received_on" | "cash_amount" | "wht_amount" | "method" | "reference"> | null;
  reference: string | null;
  response?: ClientResponse | null;
  schedule?: ScheduleRow[] | null;
}): Promise<PdfExtras> {
  const extras: PdfExtras = { reference, payment: payment as Payment | null, response, schedule, logo: await fetchLogo(doc) };

  if (doc.type === "invoice" && doc.status !== "void" && balance) {
    const due = amountsDue(doc, balance);
    if (due.outstanding > 0) {
      const seller = doc.seller_snapshot as SellerWithPayment | null;
      const promptpay = seller?.promptpay_id ?? null;
      extras.due = {
        cashDue: due.cashDue,
        paid: Number(balance.settled),
        promptpay,
        banks: (seller?.bank_accounts ?? []).filter((b) => b.bank || b.account_no),
        qr: promptpay ? await QRCode.toDataURL(promptPayPayload(promptpay, due.cashDue), { margin: 1, width: 300 }) : null,
      };
    }
  }
  return extras;
}

// Fetched up front so a missing or broken logo never fails the whole PDF.
async function fetchLogo(doc: DocumentRow): Promise<PdfExtras["logo"]> {
  const url = logoUrl(doc.seller_snapshot?.logo_path);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    const mime = sniffImageType(data);
    return mime ? { data, format: mime === "image/png" ? "png" : "jpg" } : null;
  } catch {
    return null;
  }
}

export function pdfResponse(pdf: Buffer, number: string | null, fallbackName: string, download: boolean) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${number ?? fallbackName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
