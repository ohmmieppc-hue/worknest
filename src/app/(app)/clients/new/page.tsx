import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { DOC_META } from "@/lib/documents";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "เพิ่มลูกค้า" };

export default async function NewClientPage({ searchParams }: PageProps<"/clients/new">) {
  const { next: nextParam } = await searchParams;
  const next = nextParam === "quotation" || nextParam === "invoice" ? nextParam : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader title="เพิ่มลูกค้า" />
      <Card className="p-6">
        <ClientForm
          action={createClientAction}
          next={next}
          submitLabel={next ? `บันทึกและสร้าง${DOC_META[next].label}` : "บันทึกลูกค้า"}
        />
      </Card>
    </div>
  );
}
