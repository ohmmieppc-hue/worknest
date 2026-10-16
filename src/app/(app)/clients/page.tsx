import type { Metadata } from "next";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ClientStatusBadge } from "@/components/status-badge";
import { DataList, ListToolbar, Pagination, StatGrid, TabNav } from "@/components/list-kit";
import { clientKindLabel, clientStatusLabel, formatMoney, todayISO } from "@/lib/format";
import { pageRange, parseListParams, searchTerm } from "@/lib/list";
import { requireWorkspace } from "@/lib/workspace";
import type { Client, ClientStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ลูกค้า" };

const PATH = "/clients";
const TABS: { key: string; label: string; status?: ClientStatus }[] = [
  { key: "all", label: "ทั้งหมด" },
  ...(Object.entries(clientStatusLabel) as [ClientStatus, string][]).map(([status, label]) => ({ key: status, label, status })),
];

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function ClientsPage(props: PageProps<"/clients">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientsPageContent {...props} />
    </Suspense>
  );
}

async function ClientsPageContent({ searchParams }: PageProps<"/clients">) {
  const params = parseListParams(await searchParams);
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const term = searchTerm(params.q);
  const [from, to] = pageRange(params.page);

  const { supabase } = await requireWorkspace();
  const monthStart = `${todayISO().slice(0, 7)}-01`;
  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (tab.status) query = query.eq("status", tab.status);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,tax_id.ilike.%${term}%`);

  const [{ data, count }, { data: summary }, { data: balances }] = await Promise.all([
    query,
    supabase.from("clients").select("status, created_at").is("archived_at", null),
    supabase.from("invoice_balances").select("client_id, outstanding").neq("payment_status", "paid"),
  ]);
  const clients = (data ?? []) as Client[];
  const all = (summary ?? []) as Pick<Client, "status" | "created_at">[];

  // Outstanding per client, across all of their unpaid invoices.
  const owed = new Map<string, number>();
  for (const b of (balances ?? []) as { client_id: string; outstanding: string }[]) {
    owed.set(b.client_id, (owed.get(b.client_id) ?? 0) + Number(b.outstanding));
  }
  const totalOwed = [...owed.values()].reduce((s, v) => s + v, 0);
  const statusCount = (status: ClientStatus) => all.filter((c) => c.status === status).length;
  const newThisMonth = all.filter((c) => c.created_at.slice(0, 10) >= monthStart).length;

  return (
    <div>
      <PageHeader
        title="ลูกค้า"
        description="ลูกค้าและว่าที่ลูกค้าที่ติดต่อเข้ามา"
        actions={<LinkButton href="/clients/new">+ เพิ่มลูกค้า</LinkButton>}
      />

      <StatGrid
        stats={[
          { label: "ลูกค้าที่ทำงานด้วย", value: statusCount("active"), hint: `ทั้งหมด ${all.length} ราย` },
          { label: "ว่าที่ลูกค้า", value: statusCount("lead"), tone: statusCount("lead") ? "warning" : "default" },
          { label: "ยอดค้างรับรวม", value: formatMoney(totalOwed), hint: `${owed.size} ราย` },
          { label: "ลูกค้าใหม่เดือนนี้", value: newThisMonth, tone: newThisMonth ? "success" : "default" },
        ]}
      />

      <ListToolbar path={PATH} params={params} placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือเลขผู้เสียภาษี" />
      <TabNav path={PATH} params={params} tabs={TABS.map((t) => ({ ...t, count: t.status ? statusCount(t.status) : undefined }))} />

      <DataList
        rows={clients}
        href={(c) => `${PATH}/${c.id}`}
        columns={[
          {
            header: "ชื่อ",
            cell: (c) => (
              <>
                {c.name}
                {c.tax_id && <div className="text-xs font-normal text-stone-500">{c.tax_id}</div>}
              </>
            ),
          },
          { header: "ประเภท", cell: (c) => clientKindLabel[c.kind], className: "text-stone-600" },
          {
            header: "ติดต่อ",
            cell: (c) => (
              <>
                <div>{c.email ?? "—"}</div>
                {c.phone && <div className="text-xs text-stone-500">{c.phone}</div>}
              </>
            ),
            className: "text-stone-600",
          },
          { header: "ยอดค้างรับ", cell: (c) => (owed.get(c.id) ? formatMoney(owed.get(c.id)!) : "—"), align: "right" },
          { header: "สถานะ", cell: (c) => <ClientStatusBadge status={c.status} /> },
        ]}
        mobile={(c) => ({
          title: c.name,
          badge: <ClientStatusBadge status={c.status} />,
          subtitle: [c.email, c.phone].filter(Boolean).join(" · ") || clientKindLabel[c.kind],
          meta: owed.get(c.id) ? "ค้างรับ" : undefined,
          amount: owed.get(c.id) ? formatMoney(owed.get(c.id)!) : undefined,
        })}
        empty={
          term || tab.status ? (
            <EmptyState title="ไม่พบลูกค้าที่ตรงกับการค้นหา" description={params.q ? `ค้นหา “${params.q}”` : undefined} />
          ) : (
            <EmptyState
              title="ยังไม่มีลูกค้า"
              description="เพิ่มลูกค้ารายแรกเพื่อเริ่มสร้างใบเสนอราคา"
              action={<LinkButton href="/clients/new">+ เพิ่มลูกค้า</LinkButton>}
            />
          )
        }
      />
      <Pagination path={PATH} params={params} total={count ?? 0} />
    </div>
  );
}
