import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { DocumentPdf } from "@/lib/pdf/document-pdf";
import { buildPdfExtras, pdfResponse } from "@/lib/pdf/extras";
import { getPortalDocument } from "@/lib/portal";

// Public PDF for a share link; access is decided by portal_get_document().
export async function GET(request: NextRequest, { params }: RouteContext<"/p/[token]/pdf">) {
  const { token } = await params;
  const { data } = await getPortalDocument(token);
  if (!data) return NextResponse.json({ error: "invalid or expired link" }, { status: 404 });

  const extras = await buildPdfExtras({
    doc: data.document,
    balance: data.balance,
    payment: data.payment,
    reference: data.reference,
  });
  const pdf = await renderToBuffer(<DocumentPdf doc={data.document} items={data.items} extras={extras} />);
  return pdfResponse(pdf, data.document.number, "document", !!request.nextUrl.searchParams.get("download"));
}
