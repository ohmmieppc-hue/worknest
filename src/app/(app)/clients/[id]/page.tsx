import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { ClientStatusBadge, DocumentStatusBadge } from "@/components/status-badge";
import { formatDate, formatMoney } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";
import type { Client, DocumentRow } from "@/lib/types";
import { ClientForm } from "../client-form";
import { archiveClientAction, updateClientAction } from "../actions";

export const metadata: Metadata = { title: "ลูกค้า" };

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { supabase } = await requireWorkspace();

  const [{ data: client }, { data: docs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("documents")
      .select("id, number, title, status, issue_date, total")
      .eq("client_id", id)
      .eq("type", "quotation")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (!client) notFound();
  const c = client as Client;
  const quotations = (docs ?? []) as Pick<DocumentRow, "id" | "number" | "title" | "status" | "issue_date" | "total">[];

  return (
    <div>
      <PageHeader
        title={c.name}
        actions={
          <>
            <LinkButton href={`/quotations/new?client=${c.id}`}>+ สร้างใบเสนอราคา</LinkButton>
            <form action={archiveClientAction.bind(null, c.id)}>
              <Button variant="ghost">เก็บเข้าคลัง</Button>
            </form>
          </>
        }
      />
      <div className="mb-6 -mt-4">
        <ClientStatusBadge status={c.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">ข้อมูลลูกค้า</h2>
          <ClientForm action={updateClientAction.bind(null, c.id)} client={c} submitLabel="บันทึกการแก้ไข" />
        </Card>

        <Card className="h-fit overflow-hidden">
          <h2 className="border-b border-stone-200 px-4 py-3 font-semibold">ใบเสนอราคา</h2>
          {quotations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">ยังไม่มีใบเสนอราคา</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {quotations.map((q) => (
                <li key={q.id}>
                  <Link href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{q.title || q.number || "ใบเสนอราคา (ร่าง)"}</div>
                      <div className="text-xs text-stone-500">
                        {q.number ?? "ยังไม่มีเลขที่"} · {formatDate(q.issue_date)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm tabular-nums">{formatMoney(q.total)}</div>
                      <DocumentStatusBadge status={q.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
