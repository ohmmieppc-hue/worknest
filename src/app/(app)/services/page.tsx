import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/components/page-skeleton";
import { requireWorkspace } from "@/lib/workspace";
import type { ServiceItem } from "@/lib/types";
import { ServiceRow } from "./service-form";

export const metadata: Metadata = { title: "รายการบริการ" };

export default function ServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ServicesPageContent />
    </Suspense>
  );
}

async function ServicesPageContent() {
  const { supabase } = await requireWorkspace();
  const { data } = await supabase.from("service_items").select("*").is("archived_at", null).order("name");
  const services = (data ?? []) as ServiceItem[];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="รายการบริการ"
        description="บริการที่รับทำเป็นประจำ เลือกใส่ในใบเสนอราคาและใบแจ้งหนี้ได้ทันที ราคาที่แก้ภายหลังไม่กระทบเอกสารที่ออกไปแล้ว"
      />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} />
          ))}
          <ServiceRow service={null} />
        </ul>
      </Card>
    </div>
  );
}
