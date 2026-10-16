import type { Metadata } from "next";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DataList, ListToolbar, Pagination, StatGrid, TabNav } from "@/components/list-kit";
import { addDaysISO, formatDate, formatMoney, todayISO } from "@/lib/format";
import { documentSearchFilter } from "@/lib/document-data";
import { pageRange, parseListParams, searchTerm } from "@/lib/list";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, DocumentStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบเสนอราคา" };

const PATH = "/quotations";
const PENDING: DocumentStatus[] = ["issued", "sent", "viewed"];
const TABS: { key: string; label: string; statuses?: DocumentStatus[] }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: "ร่าง", statuses: ["draft"] },
  { key: "pending", label: "รอตอบรับ", statuses: PENDING },
  { key: "accepted", label: "ตอบรับแล้ว", statuses: ["accepted"] },
  { key: "closed", label: "ปฏิเสธ / หมดอายุ / ยกเลิก", statuses: ["rejected", "expired", "void"] },
];

type Row = Pick<DocumentRow, "id" | "number" | "title" | "status" | "issue_date" | "valid_until" | "total"> & {
  client: { name: string } | null;
};

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function QuotationsPage(props: PageProps<"/quotations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuotationsPageContent {...props} />
    </Suspense>
  );
}

async function QuotationsPageContent({ searchParams }: PageProps<"/quotations">) {
  const params = parseListParams(await searchParams);
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const term = searchTerm(params.q);
  const [from, to] = pageRange(params.page);

  const { supabase } = await requireWorkspace();
  let query = supabase
    .from("documents")
    .select("id, number, title, status, issue_date, valid_until, total, client:clients(name)", { count: "exact" })
    .eq("type", "quotation")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (term) query = query.or(await documentSearchFilter(supabase, term));

  const [{ data, count }, { data: summary }] = await Promise.all([
    query,
    supabase.from("documents").select("status, total, valid_until").eq("type", "quotation"),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  // Summary cards and tab counts cover every quotation, not just this page.
  const all = (summary ?? []) as Pick<DocumentRow, "status" | "total" | "valid_until">[];
  const sum = (list: typeof all) => list.reduce((s, d) => s + Number(d.total), 0);
  const pending = all.filter((d) => PENDING.includes(d.status));
  const accepted = all.filter((d) => d.status === "accepted");
  const decided = all.filter((d) => ["accepted", "rejected", "expired"].includes(d.status)).length;
  const soon = addDaysISO(todayISO(), 3);
  const expiring = pending.filter((d) => d.valid_until && d.valid_until <= soon);

  return (
    <div>
      <PageHeader
        title="ใบเสนอราคา"
        description="เสนอราคา ส่งลิงก์ให้ลูกค้าตอบรับ แล้วต่อเป็นใบแจ้งหนี้"
        actions={<LinkButton href="/quotations/new">+ สร้างใบเสนอราคา</LinkButton>}
      />

      <StatGrid
        stats={[
          { label: "รอลูกค้าตอบรับ", value: formatMoney(sum(pending)), hint: `${pending.length} ใบ` },
          { label: "ตอบรับแล้ว", value: formatMoney(sum(accepted)), hint: `${accepted.length} ใบ`, tone: "success" },
          {
            label: "อัตราตอบรับ",
            value: decided ? `${Math.round((accepted.length / decided) * 100)}%` : "—",
            hint: decided ? `จาก ${decided} ใบที่ได้คำตอบ` : "ยังไม่มีใบที่ได้คำตอบ",
          },
          {
            label: "หมดอายุใน 3 วัน",
            value: `${expiring.length} ใบ`,
            hint: expiring.length ? "ติดตามลูกค้าก่อนหมดอายุ" : "ไม่มี",
            tone: expiring.length ? "warning" : "default",
          },
        ]}
      />

      <ListToolbar path={PATH} params={params} placeholder="ค้นหาเลขที่ ชื่องาน หรือชื่อลูกค้า" />
      <TabNav
        path={PATH}
        params={params}
        tabs={TABS.map((t) => ({ ...t, count: t.statuses ? all.filter((d) => t.statuses!.includes(d.status)).length : undefined }))}
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
          { header: "วันที่", cell: (r) => formatDate(r.issue_date), className: "whitespace-nowrap text-stone-600" },
          { header: "ยืนราคาถึง", cell: (r) => formatDate(r.valid_until), className: "whitespace-nowrap text-stone-600" },
          { header: "ยอดรวม", cell: (r) => formatMoney(r.total), align: "right" },
          { header: "สถานะ", cell: (r) => <DocumentStatusBadge status={r.status} /> },
        ]}
        mobile={(r) => ({
          title: r.number ?? "ร่าง",
          badge: <DocumentStatusBadge status={r.status} />,
          subtitle: [r.client?.name, r.title].filter(Boolean).join(" · "),
          meta: `ยืนราคาถึง ${formatDate(r.valid_until)}`,
          amount: formatMoney(r.total),
        })}
        empty={
          term ? (
            <EmptyState title="ไม่พบใบเสนอราคาที่ตรงกับการค้นหา" description={`ค้นหา “${params.q}”`} />
          ) : tab.key === "all" ? (
            <EmptyState
              title="ยังไม่มีใบเสนอราคา"
              description="สร้างใบเสนอราคาแรก แล้วส่งลิงก์ให้ลูกค้าตอบรับได้เลย"
              action={<LinkButton href="/quotations/new">+ สร้างใบเสนอราคา</LinkButton>}
            />
          ) : (
            <EmptyState title="ไม่มีใบเสนอราคาในหมวดนี้" />
          )
        }
      />
      <Pagination path={PATH} params={params} total={count ?? 0} />
    </div>
  );
}
