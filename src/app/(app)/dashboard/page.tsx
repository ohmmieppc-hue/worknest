import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { docPath, DOC_META, eventLabel } from "@/lib/documents";
import { formatDate, formatDateTime, formatMoney, todayISO } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, DocumentType, InvoiceBalance } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ภาพรวม" };

type InvoiceRow = Pick<DocumentRow, "id" | "number" | "due_date"> & { client: { name: string } | null };
type QuoteRow = Pick<DocumentRow, "id" | "number" | "status" | "valid_until" | "total"> & { client: { name: string } | null };
type EventRow = {
  id: number;
  event: string;
  actor: "owner" | "client" | "system";
  actor_name: string | null;
  created_at: string;
  document: { id: string; type: DocumentType; number: string | null } | null;
};

// The Suspense boundary lives inside the page so client navigations into this
// route can show the skeleton instantly.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  const { supabase, workspace } = await requireWorkspace();
  const monthStart = `${todayISO().slice(0, 7)}-01`;

  const [{ data: balances }, { data: invoiceDocs }, { data: quotes }, { data: monthPayments }, { count: whtPending }, { data: events }] =
    await Promise.all([
      supabase.from("invoice_balances").select("*"),
      supabase.from("documents").select("id, number, due_date, client:clients(name)").eq("type", "invoice").not("status", "in", "(draft,void)"),
      supabase
        .from("documents")
        .select("id, number, status, valid_until, total, client:clients(name)")
        .eq("type", "quotation")
        .in("status", ["issued", "sent", "viewed"])
        .order("valid_until"),
      supabase.from("payments").select("cash_amount").gte("received_on", monthStart),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("wht_cert_status", "pending"),
      supabase
        .from("document_events")
        .select("id, event, actor, actor_name, created_at, document:documents(id, type, number)")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const balanceById = new Map(((balances ?? []) as InvoiceBalance[]).map((b) => [b.invoice_id, b]));
  const invoices = ((invoiceDocs ?? []) as unknown as InvoiceRow[])
    .map((i) => ({ ...i, balance: balanceById.get(i.id) }))
    .filter((i) => i.balance && Number(i.balance.outstanding) > 0)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const overdue = invoices.filter((i) => i.balance?.is_overdue);
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance?.outstanding ?? 0), 0);
  const overdueTotal = overdue.reduce((s, i) => s + Number(i.balance?.outstanding ?? 0), 0);
  const receivedThisMonth = (monthPayments ?? []).reduce((s, p) => s + Number(p.cash_amount), 0);
  const awaiting = (quotes ?? []) as unknown as QuoteRow[];
  const recent = (events ?? []) as unknown as EventRow[];

  return (
    <div>
      <PageHeader
        title={`สวัสดี ${workspace.display_name}`}
        description="ภาพรวมงานและการเงินของคุณ"
        actions={
          <>
            <LinkButton href="/quotations/new">+ ใบเสนอราคา</LinkButton>
            <LinkButton href="/invoices/new" variant="secondary">
              + ใบแจ้งหนี้
            </LinkButton>
            <LinkButton href="/clients/new" variant="secondary">
              + ลูกค้า
            </LinkButton>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="ยอดค้างรับ" value={formatMoney(outstanding)} note={`${invoices.length} ใบแจ้งหนี้`} href="/invoices?tab=unpaid" />
        <Stat
          label="เกินกำหนดชำระ"
          value={formatMoney(overdueTotal)}
          note={`${overdue.length} ใบ`}
          tone={overdue.length ? "danger" : undefined}
          href="/invoices?tab=overdue"
        />
        <Stat label="รอลูกค้าตอบรับ" value={String(awaiting.length)} note="ใบเสนอราคา" href="/quotations?tab=pending" />
        <Stat
          label="รับเงินเดือนนี้"
          value={formatMoney(receivedThisMonth)}
          note={whtPending ? `รอใบ 50 ทวิ ${whtPending} รายการ` : "ยอดเงินที่เข้าบัญชีจริง"}
          tone={whtPending ? "warning" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ต้องติดตามเก็บเงิน" href="/invoices?tab=unpaid">
          {invoices.length === 0 ? (
            <EmptyState title="ไม่มียอดค้างรับ" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {invoices.slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link href={docPath("invoice", i.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{i.client?.name ?? "—"}</div>
                      <div className={`text-xs ${i.balance?.is_overdue ? "font-medium text-red-700" : "text-stone-500"}`}>
                        {i.number} · {i.balance?.is_overdue ? "เกินกำหนด" : "ครบกำหนด"} {formatDate(i.due_date)}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">{formatMoney(i.balance?.outstanding)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="ใบเสนอราคารอตอบรับ" href="/quotations?tab=pending">
          {awaiting.length === 0 ? (
            <EmptyState title="ไม่มีใบเสนอราคาที่รอตอบรับ" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {awaiting.slice(0, 6).map((q) => {
                const expiringSoon = q.valid_until && q.valid_until <= addDays(todayISO(), 3);
                return (
                  <li key={q.id}>
                    <Link href={docPath("quotation", q.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{q.client?.name ?? "—"}</div>
                        <div className={`text-xs ${expiringSoon ? "font-medium text-amber-700" : "text-stone-500"}`}>
                          {q.number} · ยืนราคาถึง {formatDate(q.valid_until)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm tabular-nums">{formatMoney(q.total)}</div>
                        <DocumentStatusBadge status={q.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="ความเคลื่อนไหวล่าสุด" className="lg:col-span-2">
          {recent.length === 0 ? (
            <EmptyState title="ยังไม่มีความเคลื่อนไหว" description="เมื่อออกเอกสาร หรือลูกค้าเปิดดู/ตอบรับ จะแสดงที่นี่" />
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {recent.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    {e.actor === "client" && <span className="mr-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">ลูกค้า</span>}
                    {eventLabel(e.event, e.document?.type)}
                    {e.document && (
                      <>
                        {" "}
                        {DOC_META[e.document.type].label}{" "}
                        <Link href={docPath(e.document.type, e.document.id)} className="font-medium text-brand-700 hover:underline">
                          {e.document.number}
                        </Link>
                      </>
                    )}
                    {e.actor_name && <span className="text-stone-500"> โดย {e.actor_name}</span>}
                  </span>
                  <span className="text-xs text-stone-500">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Stat({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "danger" | "warning";
  href?: string;
}) {
  const toneClass = tone === "danger" ? "border-red-200 bg-red-50/40" : tone === "warning" ? "border-amber-200 bg-amber-50/40" : "";
  const body = (
    <Card className={`h-full p-4 transition ${toneClass} ${href ? "hover:border-stone-300 hover:shadow-sm" : ""}`}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${tone === "danger" ? "text-red-700" : ""}`}>{value}</p>
      {note && <p className={`mt-0.5 text-xs ${tone === "warning" ? "text-amber-800" : "text-stone-500"}`}>{note}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Panel({ title, href, className, children }: { title: string; href?: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={`overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-brand-700 hover:underline">
            ดูทั้งหมด
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}
