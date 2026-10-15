import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, InvoiceBalance } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบแจ้งหนี้" };

type Row = Pick<DocumentRow, "id" | "number" | "title" | "status" | "issue_date" | "due_date" | "total"> & {
  client: { name: string } | null;
  balance?: InvoiceBalance;
};

const TABS: { key: string; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "ทั้งหมด", match: () => true },
  { key: "unpaid", label: "ค้างชำระ", match: (r) => !!r.balance && r.balance.payment_status !== "paid" },
  { key: "overdue", label: "เกินกำหนด", match: (r) => !!r.balance?.is_overdue },
  { key: "paid", label: "ชำระครบแล้ว", match: (r) => r.balance?.payment_status === "paid" },
  { key: "draft", label: "ร่าง", match: (r) => r.status === "draft" },
  { key: "void", label: "ยกเลิก", match: (r) => r.status === "void" },
];

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function InvoicesPage(props: PageProps<"/invoices">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoicesPageContent {...props} />
    </Suspense>
  );
}

async function InvoicesPageContent({ searchParams }: PageProps<"/invoices">) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  const { supabase } = await requireWorkspace();
  const [{ data: docs }, { data: balances }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, number, title, status, issue_date, due_date, total, client:clients(name)")
      .eq("type", "invoice")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("invoice_balances").select("*"),
  ]);
  const byId = new Map(((balances ?? []) as InvoiceBalance[]).map((b) => [b.invoice_id, b]));
  const all = ((docs ?? []) as unknown as Row[]).map((r) => ({ ...r, balance: byId.get(r.id) }));
  const rows = all.filter(tab.match);

  const outstanding = all.reduce((sum, r) => sum + Number(r.balance?.outstanding ?? 0), 0);
  const overdue = all.filter((r) => r.balance?.is_overdue);

  return (
    <div>
      <PageHeader title="ใบแจ้งหนี้" actions={<LinkButton href="/invoices/new">+ สร้างใบแจ้งหนี้</LinkButton>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Card className="p-4">
          <p className="text-sm text-stone-500">ยอดค้างรับทั้งหมด</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(outstanding)}</p>
        </Card>
        <Card className={`p-4 ${overdue.length ? "border-red-200 bg-red-50/40" : ""}`}>
          <p className="text-sm text-stone-500">เกินกำหนดชำระ</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${overdue.length ? "text-red-700" : ""}`}>
            {formatMoney(overdue.reduce((s, r) => s + Number(r.balance?.outstanding ?? 0), 0))}
            <span className="ml-2 text-sm font-normal text-stone-500">{overdue.length} ใบ</span>
          </p>
        </Card>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/invoices" : `/invoices?tab=${t.key}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              t.key === tab.key ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title={tab.key === "all" ? "ยังไม่มีใบแจ้งหนี้" : "ไม่มีใบแจ้งหนี้ในหมวดนี้"}
            description={tab.key === "all" ? "สร้างจากใบเสนอราคาที่ลูกค้าตอบรับแล้ว หรือสร้างใหม่ได้ที่นี่" : undefined}
            action={tab.key === "all" ? <LinkButton href="/invoices/new">+ สร้างใบแจ้งหนี้</LinkButton> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">เลขที่</th>
                  <th className="px-4 py-2.5 font-medium">ลูกค้า / งาน</th>
                  <th className="px-4 py-2.5 font-medium">ครบกำหนด</th>
                  <th className="px-4 py-2.5 text-right font-medium">ยอดรวม</th>
                  <th className="px-4 py-2.5 text-right font-medium">คงค้าง</th>
                  <th className="px-4 py-2.5 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/invoices/${r.id}`} className="font-medium hover:text-brand-700 hover:underline">
                        {r.number ?? "ร่าง"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${r.id}`} className="block">
                        <div>{r.client?.name ?? "—"}</div>
                        {r.title && <div className="text-xs text-stone-500">{r.title}</div>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">{formatDate(r.due_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.balance ? formatMoney(r.balance.outstanding) : "—"}</td>
                    <td className="px-4 py-3">
                      {r.balance ? (
                        <PaymentStatusBadge status={r.balance.payment_status} overdue={r.balance.is_overdue} />
                      ) : (
                        <DocumentStatusBadge status={r.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
