import type { Metadata } from "next";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { DataList, ListToolbar, Pagination, StatGrid, TabNav } from "@/components/list-kit";
import { addDaysISO, formatDate, formatMoney, todayISO } from "@/lib/format";
import { documentSearchFilter } from "@/lib/document-data";
import { pageRange, parseListParams, searchTerm } from "@/lib/list";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, InvoiceBalance } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบแจ้งหนี้" };

const PATH = "/invoices";

type Row = Pick<DocumentRow, "id" | "number" | "title" | "status" | "issue_date" | "due_date" | "total"> & {
  client: { name: string } | null;
};

// Payment tabs filter on the balance view; draft / void tabs on the document status.
const TABS: { key: string; label: string; balance?: (b: InvoiceBalance) => boolean; status?: DocumentRow["status"] }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "unpaid", label: "ค้างชำระ", balance: (b) => b.payment_status !== "paid" },
  { key: "overdue", label: "เกินกำหนด", balance: (b) => b.is_overdue },
  { key: "paid", label: "ชำระครบแล้ว", balance: (b) => b.payment_status === "paid" },
  { key: "draft", label: "ร่าง", status: "draft" },
  { key: "void", label: "ยกเลิก", status: "void" },
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
  const params = parseListParams(await searchParams);
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const term = searchTerm(params.q);
  const [from, to] = pageRange(params.page);

  const { supabase } = await requireWorkspace();
  const monthStart = `${todayISO().slice(0, 7)}-01`;
  const [{ data: balanceData }, { data: statusData }, { data: payments }] = await Promise.all([
    supabase.from("invoice_balances").select("*"),
    supabase.from("documents").select("status, due_date, id").eq("type", "invoice"),
    supabase.from("payments").select("cash_amount, wht_amount").gte("received_on", monthStart),
  ]);
  const balances = (balanceData ?? []) as InvoiceBalance[];
  const statuses = (statusData ?? []) as Pick<DocumentRow, "id" | "status" | "due_date">[];

  let query = supabase
    .from("documents")
    .select("id, number, title, status, issue_date, due_date, total, client:clients(name)", { count: "exact" })
    .eq("type", "invoice")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (tab.balance) {
    const ids = balances.filter(tab.balance).map((b) => b.invoice_id);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (tab.status) query = query.eq("status", tab.status);
  if (term) query = query.or(await documentSearchFilter(supabase, term));
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const byId = new Map(balances.map((b) => [b.invoice_id, b]));

  const sum = (list: InvoiceBalance[]) => list.reduce((s, b) => s + Number(b.outstanding), 0);
  const open = balances.filter((b) => b.payment_status !== "paid");
  const overdue = balances.filter((b) => b.is_overdue);
  const week = addDaysISO(todayISO(), 7);
  const dueIds = new Set(statuses.filter((d) => d.due_date && d.due_date >= todayISO() && d.due_date <= week).map((d) => d.id));
  const dueSoon = open.filter((b) => dueIds.has(b.invoice_id) && !b.is_overdue);
  const received = (payments ?? []).reduce((s, p) => s + Number(p.cash_amount) + Number(p.wht_amount), 0);

  return (
    <div>
      <PageHeader
        title="ใบแจ้งหนี้"
        description="เรียกเก็บเงิน บันทึกรับชำระ และออกใบเสร็จ"
        actions={<LinkButton href="/invoices/new">+ สร้างใบแจ้งหนี้</LinkButton>}
      />

      <StatGrid
        stats={[
          { label: "ยอดค้างรับทั้งหมด", value: formatMoney(sum(open)), hint: `${open.length} ใบ` },
          {
            label: "เกินกำหนดชำระ",
            value: formatMoney(sum(overdue)),
            hint: `${overdue.length} ใบ`,
            tone: overdue.length ? "danger" : "default",
          },
          {
            label: "ครบกำหนดใน 7 วัน",
            value: formatMoney(sum(dueSoon)),
            hint: `${dueSoon.length} ใบ`,
            tone: dueSoon.length ? "warning" : "default",
          },
          { label: "รับชำระเดือนนี้", value: formatMoney(received), hint: `${(payments ?? []).length} รายการ`, tone: "success" },
        ]}
      />

      <ListToolbar path={PATH} params={params} placeholder="ค้นหาเลขที่ ชื่องาน หรือชื่อลูกค้า" />
      <TabNav
        path={PATH}
        params={params}
        tabs={TABS.map((t) => ({
          ...t,
          count: t.balance
            ? balances.filter(t.balance).length
            : t.status
              ? statuses.filter((d) => d.status === t.status).length
              : undefined,
        }))}
      />

      <DataList
        rows={rows}
        href={(r) => `${PATH}/${r.id}`}
        columns={[
          { header: "เลขที่", cell: (r) => r.number ?? "ร่าง", className: "whitespace-nowrap" },
          {
            header: "ลูกค้า / งาน",
            cell: (r) => (
              <>
                <div>{r.client?.name ?? "—"}</div>
                {r.title && <div className="text-xs text-stone-500">{r.title}</div>}
              </>
            ),
          },
          { header: "ครบกำหนด", cell: (r) => formatDate(r.due_date), className: "whitespace-nowrap text-stone-600" },
          { header: "ยอดรวม", cell: (r) => formatMoney(r.total), align: "right" },
          { header: "คงค้าง", cell: (r) => (byId.has(r.id) ? formatMoney(byId.get(r.id)!.outstanding) : "—"), align: "right" },
          { header: "สถานะ", cell: (r) => <Status row={r} balance={byId.get(r.id)} /> },
        ]}
        mobile={(r) => {
          const b = byId.get(r.id);
          return {
            title: r.number ?? "ร่าง",
            badge: <Status row={r} balance={b} />,
            subtitle: [r.client?.name, r.title].filter(Boolean).join(" · "),
            meta: `ครบกำหนด ${formatDate(r.due_date)}`,
            amount: b && b.payment_status !== "paid" ? `ค้าง ${formatMoney(b.outstanding)}` : formatMoney(r.total),
          };
        }}
        empty={
          term ? (
            <EmptyState title="ไม่พบใบแจ้งหนี้ที่ตรงกับการค้นหา" description={`ค้นหา “${params.q}”`} />
          ) : tab.key === "all" ? (
            <EmptyState
              title="ยังไม่มีใบแจ้งหนี้"
              description="สร้างจากใบเสนอราคาที่ลูกค้าตอบรับแล้ว หรือสร้างใหม่ได้ที่นี่"
              action={<LinkButton href="/invoices/new">+ สร้างใบแจ้งหนี้</LinkButton>}
            />
          ) : (
            <EmptyState title="ไม่มีใบแจ้งหนี้ในหมวดนี้" />
          )
        }
      />
      <Pagination path={PATH} params={params} total={count ?? 0} />
    </div>
  );
}

function Status({ row, balance }: { row: Row; balance?: InvoiceBalance }) {
  return balance ? (
    <PaymentStatusBadge status={balance.payment_status} overdue={balance.is_overdue} />
  ) : (
    <DocumentStatusBadge status={row.status} />
  );
}
