import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { DocumentStatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { DocumentRow, DocumentStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ใบเสนอราคา" };

const TABS: { key: string; label: string; statuses?: DocumentStatus[] }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "draft", label: "ร่าง", statuses: ["draft"] },
  { key: "pending", label: "รอตอบรับ", statuses: ["issued", "sent", "viewed"] },
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
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  const { supabase } = await requireWorkspace();
  let query = supabase
    .from("documents")
    .select("id, number, title, status, issue_date, valid_until, total, client:clients(name)")
    .eq("type", "quotation")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tab.statuses) query = query.in("status", tab.statuses);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div>
      <PageHeader
        title="ใบเสนอราคา"
        actions={<LinkButton href="/quotations/new">+ สร้างใบเสนอราคา</LinkButton>}
      />

      <div className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/quotations" : `/quotations?tab=${t.key}`}
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
            title={tab.key === "all" ? "ยังไม่มีใบเสนอราคา" : "ไม่มีใบเสนอราคาในหมวดนี้"}
            description={tab.key === "all" ? "สร้างใบเสนอราคาแรก แล้วส่งลิงก์ให้ลูกค้าตอบรับได้เลย" : undefined}
            action={tab.key === "all" ? <LinkButton href="/quotations/new">+ สร้างใบเสนอราคา</LinkButton> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">เลขที่</th>
                  <th className="px-4 py-2.5 font-medium">ลูกค้า / งาน</th>
                  <th className="px-4 py-2.5 font-medium">วันที่</th>
                  <th className="px-4 py-2.5 font-medium">ยืนราคาถึง</th>
                  <th className="px-4 py-2.5 text-right font-medium">ยอดรวม</th>
                  <th className="px-4 py-2.5 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/quotations/${r.id}`} className="font-medium hover:text-brand-700 hover:underline">
                        {r.number ?? "ร่าง"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/quotations/${r.id}`} className="block">
                        <div>{r.client?.name ?? "—"}</div>
                        {r.title && <div className="text-xs text-stone-500">{r.title}</div>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">{formatDate(r.issue_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">{formatDate(r.valid_until)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.total)}</td>
                    <td className="px-4 py-3">
                      <DocumentStatusBadge status={r.status} />
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
