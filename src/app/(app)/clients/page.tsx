import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { ClientStatusBadge } from "@/components/status-badge";
import { clientKindLabel, clientStatusLabel } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { Client, ClientStatus } from "@/lib/types";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ลูกค้า" };

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
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" && params.status in clientStatusLabel ? (params.status as ClientStatus) : "";

  const { supabase } = await requireWorkspace();
  let query = supabase
    .from("clients")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) {
    // Strip characters that have meaning in PostgREST filter syntax.
    const term = q.replace(/[,()*%\\]/g, " ");
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,tax_id.ilike.%${term}%`);
  }
  const { data } = await query;
  const clients = (data ?? []) as Client[];
  const filtered = Boolean(q || status);

  return (
    <div>
      <PageHeader
        title="ลูกค้า"
        description="ลูกค้าและผู้ที่ติดต่อเข้ามา (Lead)"
        actions={<LinkButton href="/clients/new">+ เพิ่มลูกค้า</LinkButton>}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือเลขผู้เสียภาษี"
          className={`${inputClass} max-w-sm`}
        />
        <select name="status" defaultValue={status} className={`${inputClass} w-auto`}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(clientStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-stone-50">
          ค้นหา
        </button>
      </form>

      <Card className="overflow-hidden">
        {clients.length === 0 ? (
          filtered ? (
            <EmptyState title="ไม่พบลูกค้าที่ตรงกับการค้นหา" />
          ) : (
            <EmptyState
              title="ยังไม่มีลูกค้า"
              description="เพิ่มลูกค้ารายแรกเพื่อเริ่มสร้างใบเสนอราคา"
              action={<LinkButton href="/clients/new">+ เพิ่มลูกค้า</LinkButton>}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ชื่อ</th>
                  <th className="px-4 py-2.5 font-medium">ประเภท</th>
                  <th className="px-4 py-2.5 font-medium">ติดต่อ</th>
                  <th className="px-4 py-2.5 font-medium">หัก ณ ที่จ่าย</th>
                  <th className="px-4 py-2.5 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-700 hover:underline">
                        {c.name}
                      </Link>
                      {c.tax_id && <div className="text-xs text-stone-500">{c.tax_id}</div>}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{clientKindLabel[c.kind]}</td>
                    <td className="px-4 py-3 text-stone-600">
                      <div>{c.email ?? "—"}</div>
                      {c.phone && <div className="text-xs text-stone-500">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {Number(c.default_wht_rate) > 0 ? `${Number(c.default_wht_rate)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ClientStatusBadge status={c.status} />
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
