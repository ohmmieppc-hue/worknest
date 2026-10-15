import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { DOC_META } from "@/lib/documents";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "เพิ่มลูกค้า" };

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function NewClientPage(props: PageProps<"/clients/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewClientPageContent {...props} />
    </Suspense>
  );
}

async function NewClientPageContent({ searchParams }: PageProps<"/clients/new">) {
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
