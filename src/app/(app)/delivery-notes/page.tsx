import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, DocumentStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบส่งมอบงาน" };

const TABS: { key: string; label: string; statuses?: DocumentStatus[] }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: "ร่าง", statuses: ["draft"] },
  { key: "pending", label: "รอตรวจรับ", statuses: ["issued", "sent", "viewed"] },
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
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  const { supabase } = await requireWorkspace();
  let query = supabase
    .from("documents")
    .select("id, number, title, status, issue_date, source_document_id, client:clients(name)")
    .eq("type", "delivery_note")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tab.statuses) query = query.in("status", tab.statuses);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Quotation numbers for the "delivered against" column.
  const sourceIds = [...new Set(rows.map((r) => r.source_document_id).filter((id): id is string => !!id))];
  const { data: sources } = sourceIds.length
    ? await supabase.from("documents").select("id, number").in("id", sourceIds)
    : { data: [] };
  const quotationNumber = new Map((sources ?? []).map((q) => [q.id as string, q.number as string | null]));

  return (
    <div>
      <PageHeader
        title="ใบส่งมอบงาน"
        description="ส่งมอบงานตามใบเสนอราคา ให้ลูกค้าตรวจรับหรือขอแก้ไขผ่านลิงก์"
        actions={<LinkButton href="/quotations?tab=accepted" variant="secondary">เลือกใบเสนอราคาที่จะส่งมอบ</LinkButton>}
      />

      <div className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/delivery-notes" : `/delivery-notes?tab=${t.key}`}
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
            title={tab.key === "all" ? "ยังไม่มีใบส่งมอบงาน" : "ไม่มีใบส่งมอบงานในหมวดนี้"}
            description={
              tab.key === "all" ? "เปิดใบเสนอราคาที่ลูกค้าตอบรับแล้ว แล้วกด “สร้างใบส่งมอบงาน” เมื่อพร้อมส่งงาน" : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">เลขที่</th>
                  <th className="px-4 py-2.5 font-medium">ลูกค้า / งาน</th>
                  <th className="px-4 py-2.5 font-medium">ใบเสนอราคา</th>
                  <th className="px-4 py-2.5 font-medium">วันที่ส่งมอบ</th>
                  <th className="px-4 py-2.5 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/delivery-notes/${r.id}`} className="font-medium hover:text-brand-700 hover:underline">
                        {r.number ?? "ร่าง"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/delivery-notes/${r.id}`} className="block">
                        <div>{r.client?.name ?? "—"}</div>
                        {r.title && <div className="text-xs text-stone-500">{r.title}</div>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">{(r.source_document_id && quotationNumber.get(r.source_document_id)) ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">{formatDate(r.issue_date)}</td>
                    <td className="px-4 py-3">
                      <DocumentStatusBadge status={r.status} type="delivery_note" />
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
