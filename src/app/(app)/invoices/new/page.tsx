import type { Metadata } from "next";
import { NewDocument } from "@/components/new-document";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "สร้างใบแจ้งหนี้" };

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function NewInvoicePage(props: PageProps<"/invoices/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewInvoicePageContent {...props} />
    </Suspense>
  );
}

async function NewInvoicePageContent({ searchParams }: PageProps<"/invoices/new">) {
  const { client, error } = await searchParams;
  return (
    <NewDocument
      type="invoice"
      preselected={typeof client === "string" ? client : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
