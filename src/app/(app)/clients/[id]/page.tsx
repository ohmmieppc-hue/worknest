import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { ClientStatusBadge, DocumentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { Client, DocumentRow, InvoiceBalance } from "@/lib/types";
import { ClientForm } from "../client-form";
import { updateClientAction } from "../actions";
import { ArchiveClientButton } from "./archive-button";

export const metadata: Metadata = { title: "ลูกค้า" };

type DocRow = Pick<DocumentRow, "id" | "type" | "number" | "title" | "status" | "issue_date" | "due_date" | "total">;

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function ClientPage(props: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientPageContent {...props} />
    </Suspense>
  );
}

async function ClientPageContent({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { supabase } = await requireWorkspace();

  const [{ data: client }, { data: docs }, { data: balanceData }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("documents")
      .select("id, type, number, title, status, issue_date, due_date, total")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("invoice_balances").select("*").eq("client_id", id),
  ]);
  if (!client) notFound();
  const c = client as Client;
  const all = (docs ?? []) as DocRow[];
  const quotations = all.filter((d) => d.type === "quotation");
  const invoices = all.filter((d) => d.type === "invoice");
  const deliveries = all.filter((d) => d.type === "delivery_note");
  const receipts = all.filter((d) => d.type === "receipt" && d.status !== "draft");
  const balances = (balanceData ?? []) as InvoiceBalance[];
  const balanceById = new Map(balances.map((b) => [b.invoice_id, b]));

  const outstanding = balances.reduce((s, b) => s + Number(b.outstanding), 0);
  const overdue = balances.filter((b) => b.is_overdue).reduce((s, b) => s + Number(b.outstanding), 0);
  const received = balances.reduce((s, b) => s + Number(b.cash_received), 0);
  const accepted = quotations.filter((q) => q.status === "accepted").reduce((s, q) => s + Number(q.total), 0);

  return (
    <div>
      <PageHeader
        title={c.name}
        actions={
          <>
            <LinkButton href={`/quotations/new?client=${c.id}`}>+ ใบเสนอราคา</LinkButton>
            <LinkButton href={`/invoices/new?client=${c.id}`} variant="secondary">
              + ใบแจ้งหนี้
            </LinkButton>
            <ArchiveClientButton id={c.id} name={c.name} />
          </>
        }
      />
      <div className="mb-6 -mt-4">
        <ClientStatusBadge status={c.status} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="ยอดค้างรับ" value={outstanding} highlight={outstanding > 0} />
        <Stat label="เกินกำหนด" value={overdue} danger={overdue > 0} />
        <Stat label="รับเงินแล้วทั้งหมด" value={received} />
        <Stat label="มูลค่างานที่ตอบรับ" value={accepted} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">ข้อมูลลูกค้า</h2>
          <ClientForm action={updateClientAction.bind(null, c.id)} client={c} submitLabel="บันทึกการแก้ไข" />
        </Card>

        <div className="space-y-6">
          <DocList title="ใบแจ้งหนี้" empty="ยังไม่มีใบแจ้งหนี้">
            {invoices.map((inv) => {
              const b = balanceById.get(inv.id);
              return (
                <DocItem
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  title={inv.title || inv.number || "ใบแจ้งหนี้ (ร่าง)"}
                  meta={`${inv.number ?? "ยังไม่มีเลขที่"} · ครบกำหนด ${formatDate(inv.due_date)}`}
                  amount={b && Number(b.outstanding) > 0 ? `ค้าง ${formatMoney(b.outstanding)}` : formatMoney(inv.total)}
                  badge={b ? <PaymentStatusBadge status={b.payment_status} overdue={b.is_overdue} /> : <DocumentStatusBadge status={inv.status} />}
                />
              );
            })}
          </DocList>

          <DocList title="ใบเสนอราคา" empty="ยังไม่มีใบเสนอราคา">
            {quotations.map((q) => (
              <DocItem
                key={q.id}
                href={`/quotations/${q.id}`}
                title={q.title || q.number || "ใบเสนอราคา (ร่าง)"}
                meta={`${q.number ?? "ยังไม่มีเลขที่"} · ${formatDate(q.issue_date)}`}
                amount={formatMoney(q.total)}
                badge={<DocumentStatusBadge status={q.status} />}
              />
            ))}
          </DocList>

          <DocList title="ใบส่งมอบงาน" empty="ยังไม่มีใบส่งมอบงาน">
            {deliveries.map((dn) => (
              <DocItem
                key={dn.id}
                href={`/delivery-notes/${dn.id}`}
                title={dn.title || dn.number || "ใบส่งมอบงาน (ร่าง)"}
                meta={`${dn.number ?? "ยังไม่มีเลขที่"} · ${formatDate(dn.issue_date)}`}
                amount=""
                badge={<DocumentStatusBadge status={dn.status} type="delivery_note" />}
              />
            ))}
          </DocList>

          <DocList title="ใบเสร็จรับเงิน" empty="ยังไม่มีใบเสร็จ">
            {receipts.map((rc) => (
              <DocItem
                key={rc.id}
                href={`/receipts/${rc.id}`}
                title={rc.title || rc.number || "ใบเสร็จรับเงิน"}
                meta={`${rc.number} · ${formatDate(rc.issue_date)}`}
                amount={formatMoney(rc.total)}
                badge={rc.status === "void" ? <DocumentStatusBadge status={rc.status} /> : null}
              />
            ))}
          </DocList>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, danger }: { label: string; value: number; highlight?: boolean; danger?: boolean }) {
  const tone = danger ? "border-red-200 bg-red-50/40" : highlight ? "border-amber-200 bg-amber-50/40" : "";
  return (
    <Card className={`p-4 ${tone}`}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${danger ? "text-red-700" : ""}`}>{formatMoney(value)}</p>
    </Card>
  );
}

function DocList({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <Card className="h-fit overflow-hidden">
      <h2 className="border-b border-stone-200 px-4 py-3 font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="px-4 py-6 text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-stone-100">{children}</ul>
      )}
    </Card>
  );
}

function DocItem({ href, title, meta, amount, badge }: { href: string; title: string; meta: string; amount: string; badge: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="text-xs text-stone-500">{meta}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm tabular-nums">{amount}</div>
          {badge}
        </div>
      </Link>
    </li>
  );
}
