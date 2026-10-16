import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ListToolbar, Pagination, StatGrid } from "@/components/list-kit";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatMoney } from "@/lib/format";
import { pageRange, parseListParams, searchTerm } from "@/lib/list";
import { requireWorkspace } from "@/lib/workspace";
import type { ServiceItem } from "@/lib/types";
import { ServiceRow } from "./service-form";

export const metadata: Metadata = { title: "รายการบริการ" };

const PATH = "/services";

export default function ServicesPage(props: PageProps<"/services">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ServicesPageContent {...props} />
    </Suspense>
  );
}

async function ServicesPageContent({ searchParams }: PageProps<"/services">) {
  const params = parseListParams(await searchParams);
  const term = searchTerm(params.q);
  const [from, to] = pageRange(params.page);

  const { supabase } = await requireWorkspace();
  let query = supabase.from("service_items").select("*", { count: "exact" }).is("archived_at", null).order("name").range(from, to);
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);

  const [{ data, count }, { data: summary }, { data: usage }] = await Promise.all([
    query,
    supabase.from("service_items").select("id, name, unit_price").is("archived_at", null),
    supabase.from("document_items").select("service_item_id").not("service_item_id", "is", null),
  ]);
  const services = (data ?? []) as ServiceItem[];
  const all = (summary ?? []) as Pick<ServiceItem, "id" | "name" | "unit_price">[];

  // How often each saved service has been picked into a document.
  const uses = new Map<string, number>();
  for (const u of (usage ?? []) as { service_item_id: string }[]) uses.set(u.service_item_id, (uses.get(u.service_item_id) ?? 0) + 1);
  const top = all.reduce<(typeof all)[number] | null>((best, s) => ((uses.get(s.id) ?? 0) > (best ? (uses.get(best.id) ?? 0) : 0) ? s : best), null);
  const avg = all.length ? all.reduce((s, x) => s + Number(x.unit_price), 0) / all.length : 0;

  return (
    <div>
      <PageHeader
        title="รายการบริการ"
        description="บริการที่รับทำเป็นประจำ เลือกใส่ในใบเสนอราคาและใบแจ้งหนี้ได้ทันที ราคาที่แก้ภายหลังไม่กระทบเอกสารที่ออกไปแล้ว"
      />

      <StatGrid
        stats={[
          { label: "บริการทั้งหมด", value: all.length },
          { label: "ใช้ในเอกสารแล้ว", value: `${(usage ?? []).length} ครั้ง` },
          { label: "ใช้บ่อยที่สุด", value: <span className="block truncate text-base sm:text-lg">{top?.name ?? "—"}</span>, hint: top ? `${uses.get(top.id)} ครั้ง` : undefined },
          { label: "ราคาเฉลี่ย", value: formatMoney(avg) },
        ]}
      />

      <ListToolbar path={PATH} params={params} placeholder="ค้นหาชื่อหรือรายละเอียดบริการ" />

      <Card className="overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {/* Adding is always available at the top. */}
          <ServiceRow service={null} />
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} />
          ))}
        </ul>
        {services.length === 0 && term && <EmptyState title="ไม่พบบริการที่ตรงกับการค้นหา" description={`ค้นหา “${params.q}”`} />}
      </Card>
      <Pagination path={PATH} params={params} total={count ?? 0} />
    </div>
  );
}
