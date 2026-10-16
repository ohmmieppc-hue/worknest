import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DataList, ListToolbar, Pagination, StatGrid, TabNav } from "@/components/list-kit";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { documentSearchFilter } from "@/lib/document-data";
import { pageRange, parseListParams, searchTerm } from "@/lib/list";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, DocumentStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบเสร็จรับเงิน" };

const PATH = "/receipts";
const ACTIVE: DocumentStatus[] = ["issued", "sent", "viewed"];
const TABS: { key: string; label: string; statuses?: DocumentStatus[] }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "active", label: "ใช้งาน", statuses: ACTIVE },
  { key: "void", label: "ยกเลิก", statuses: ["void"] },
];

type Row = Pick<DocumentRow, "id" | "number" | "title" | "status" | "issue_date" | "total" | "source_document_id"> & {
  client: { name: string } | null;
};

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function ReceiptsPage(props: PageProps<"/receipts">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReceiptsPageContent {...props} />
    </Suspense>
  );
}

async function ReceiptsPageContent({ searchParams }: PageProps<"/receipts">) {
  const params = parseListParams(await searchParams);
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const term = searchTerm(params.q);
  const [from, to] = pageRange(params.page);

  const { supabase } = await requireWorkspace();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;

  // Receipts are issued from payments, never drafted.
  let query = supabase
    .from("documents")
    .select("id, number, title, status, issue_date, total, source_document_id, client:clients(name)", { count: "exact" })
    .eq("type", "receipt")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (term) query = query.or(await documentSearchFilter(supabase, term));

  const [{ data, count }, { data: summary }, { count: whtPending }] = await Promise.all([
    query,
    supabase.from("documents").select("status, total, issue_date").eq("type", "receipt").neq("status", "draft"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("wht_cert_status", "pending"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const all = (summary ?? []) as Pick<DocumentRow, "status" | "total" | "issue_date">[];
  const live = all.filter((r) => r.status !== "void");
  const sum = (list: typeof all) => list.reduce((s, r) => s + Number(r.total), 0);
  const thisMonth = live.filter((r) => r.issue_date >= monthStart);
  const thisYear = live.filter((r) => r.issue_date >= yearStart);

  // Invoice numbers for the "paid against" column.
  const sourceIds = [...new Set(rows.map((r) => r.source_document_id).filter((id): id is string => !!id))];
  const { data: sources } = sourceIds.length
    ? await supabase.from("documents").select("id, number").in("id", sourceIds)
    : { data: [] };
  const invoiceNumber = new Map((sources ?? []).map((d) => [d.id as string, d.number as string | null]));
  const invoiceOf = (r: Row) => (r.source_document_id && invoiceNumber.get(r.source_document_id)) || null;

  return (
    <div>
      <PageHeader title="ใบเสร็จรับเงิน" description="ออกอัตโนมัติเมื่อบันทึกรับเงินในหน้าใบแจ้งหนี้" />

      <StatGrid
        stats={[
          { label: "รับเงินเดือนนี้", value: formatMoney(sum(thisMonth)), hint: `${thisMonth.length} ใบ`, tone: "success" },
          { label: "รับเงินปีนี้", value: formatMoney(sum(thisYear)), hint: `${thisYear.length} ใบ` },
          {
            label: "รอหนังสือ 50 ทวิ",
            value: `${whtPending ?? 0} รายการ`,
            hint: whtPending ? "ติดตามจากลูกค้าที่หักภาษี" : "ครบแล้ว",
            tone: whtPending ? "warning" : "default",
          },
          { label: "ยกเลิก", value: `${all.length - live.length} ใบ` },
        ]}
      />

      <ListToolbar path={PATH} params={params} placeholder="ค้นหาเลขที่ ชื่องาน หรือชื่อลูกค้า" />
      <TabNav
        path={PATH}
        params={params}
        tabs={TABS.map((t) => ({ ...t, count: t.statuses ? all.filter((r) => t.statuses!.includes(r.status)).length : undefined }))}
      />

      <DataList
        rows={rows}
        href={(r) => `${PATH}/${r.id}`}
        columns={[
          { header: "เลขที่", cell: (r) => r.number, className: "whitespace-nowrap" },
          {
            header: "ลูกค้า / งาน",
            cell: (r) => (
              <>
                <div>{r.client?.name ?? "—"}</div>
                {r.title && <div className="text-xs text-stone-500">{r.title}</div>}
              </>
            ),
          },
          { header: "วันที่", cell: (r) => formatDate(r.issue_date), className: "whitespace-nowrap text-stone-600" },
          { header: "ใบแจ้งหนี้", cell: (r) => invoiceOf(r) ?? "—", className: "whitespace-nowrap text-stone-600" },
          { header: "ยอดรับ", cell: (r) => formatMoney(r.total), align: "right" },
          { header: "สถานะ", cell: (r) => <DocumentStatusBadge status={r.status} /> },
        ]}
        mobile={(r) => ({
          title: r.number,
          badge: r.status === "void" ? <DocumentStatusBadge status={r.status} /> : undefined,
          subtitle: [r.client?.name, r.title].filter(Boolean).join(" · "),
          meta: [formatDate(r.issue_date), invoiceOf(r)].filter(Boolean).join(" · "),
          amount: formatMoney(r.total),
        })}
        empty={
          term ? (
            <EmptyState title="ไม่พบใบเสร็จที่ตรงกับการค้นหา" description={`ค้นหา “${params.q}”`} />
          ) : (
            <EmptyState title="ยังไม่มีใบเสร็จ" description="บันทึกรับเงินในหน้าใบแจ้งหนี้ ระบบจะออกใบเสร็จให้" />
          )
        }
      />
      <Pagination path={PATH} params={params} total={count ?? 0} />
    </div>
  );
}
