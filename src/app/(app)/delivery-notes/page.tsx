import type { Metadata } from "next";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { DataList, ListToolbar, Pagination, StatGrid, TabNav } from "@/components/list-kit";
import { formatDate } from "@/lib/format";
import { documentSearchFilter } from "@/lib/document-data";
import { pageRange, parseListParams, searchTerm } from "@/lib/list";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, DocumentStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบส่งมอบงาน" };

const PATH = "/delivery-notes";
const PENDING: DocumentStatus[] = ["issued", "sent", "viewed"];
const TABS: { key: string; label: string; statuses?: DocumentStatus[] }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: "ร่าง", statuses: ["draft"] },
  { key: "pending", label: "รอตรวจรับ", statuses: PENDING },
  { key: "accepted", label: "ตรวจรับแล้ว", statuses: ["accepted"] },
  { key: "closed", label: "ขอแก้ไข / ยกเลิก", statuses: ["rejected", "void"] },
];

type Row = Pick<DocumentRow, "id" | "number" | "title" | "status" | "issue_date" | "source_document_id"> & {
  client: { name: string } | null;
};

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function DeliveryNotesPage(props: PageProps<"/delivery-notes">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeliveryNotesPageContent {...props} />
    </Suspense>
  );
}

async function DeliveryNotesPageContent({ searchParams }: PageProps<"/delivery-notes">) {
  const params = parseListParams(await searchParams);
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const term = searchTerm(params.q);
  const [from, to] = pageRange(params.page);

  const { supabase } = await requireWorkspace();
  let query = supabase
    .from("documents")
    .select("id, number, title, status, issue_date, source_document_id, client:clients(name)", { count: "exact" })
    .eq("type", "delivery_note")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (term) query = query.or(await documentSearchFilter(supabase, term));

  const [{ data, count }, { data: summary }] = await Promise.all([
    query,
    supabase.from("documents").select("status").eq("type", "delivery_note"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const all = (summary ?? []) as Pick<DocumentRow, "status">[];
  const countOf = (statuses: DocumentStatus[]) => all.filter((d) => statuses.includes(d.status)).length;

  // Quotation numbers for the "delivered against" column.
  const sourceIds = [...new Set(rows.map((r) => r.source_document_id).filter((id): id is string => !!id))];
  const { data: sources } = sourceIds.length
    ? await supabase.from("documents").select("id, number").in("id", sourceIds)
    : { data: [] };
  const quotationNumber = new Map((sources ?? []).map((q) => [q.id as string, q.number as string | null]));
  const quotationOf = (r: Row) => (r.source_document_id && quotationNumber.get(r.source_document_id)) || null;

  const pending = countOf(PENDING);
  const changes = countOf(["rejected"]);

  return (
    <div>
      <PageHeader
        title="ใบส่งมอบงาน"
        description="ส่งมอบงานตามใบเสนอราคา ให้ลูกค้าตรวจรับหรือขอแก้ไขผ่านลิงก์"
        actions={
          <LinkButton href="/quotations?tab=accepted" variant="secondary">
            เลือกใบเสนอราคาที่จะส่งมอบ
          </LinkButton>
        }
      />

      <StatGrid
        stats={[
          { label: "รอลูกค้าตรวจรับ", value: `${pending} ใบ`, tone: pending ? "warning" : "default" },
          { label: "ลูกค้าขอแก้ไข", value: `${changes} ใบ`, hint: "ส่งฉบับใหม่หลังแก้งาน" },
          { label: "ตรวจรับแล้ว", value: `${countOf(["accepted"])} ใบ`, tone: "success" },
          { label: "ร่าง", value: `${countOf(["draft"])} ใบ` },
        ]}
      />

      <ListToolbar path={PATH} params={params} placeholder="ค้นหาเลขที่ ชื่องาน หรือชื่อลูกค้า" />
      <TabNav path={PATH} params={params} tabs={TABS.map((t) => ({ ...t, count: t.statuses ? countOf(t.statuses) : undefined }))} />

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
          { header: "ใบเสนอราคา", cell: (r) => quotationOf(r) ?? "—", className: "whitespace-nowrap text-stone-600" },
          { header: "วันที่ส่งมอบ", cell: (r) => formatDate(r.issue_date), className: "whitespace-nowrap text-stone-600" },
          { header: "สถานะ", cell: (r) => <DocumentStatusBadge status={r.status} type="delivery_note" /> },
        ]}
        mobile={(r) => ({
          title: r.number ?? "ร่าง",
          badge: <DocumentStatusBadge status={r.status} type="delivery_note" />,
          subtitle: [r.client?.name, r.title].filter(Boolean).join(" · "),
          meta: formatDate(r.issue_date),
          amount: quotationOf(r),
        })}
        empty={
          term ? (
            <EmptyState title="ไม่พบใบส่งมอบงานที่ตรงกับการค้นหา" description={`ค้นหา “${params.q}”`} />
          ) : tab.key === "all" ? (
            <EmptyState
              title="ยังไม่มีใบส่งมอบงาน"
              description="เปิดใบเสนอราคาที่ลูกค้าตอบรับแล้ว แล้วกด “สร้างใบส่งมอบงาน” เมื่อพร้อมส่งงาน"
            />
          ) : (
            <EmptyState title="ไม่มีใบส่งมอบงานในหมวดนี้" />
          )
        }
      />
      <Pagination path={PATH} params={params} total={count ?? 0} />
    </div>
  );
}
