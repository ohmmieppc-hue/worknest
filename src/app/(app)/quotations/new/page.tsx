import type { Metadata } from "next";
import { NewDocument } from "@/components/new-document";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "สร้างใบเสนอราคา" };

// The Suspense boundary lives inside the page so client navigations into this
// route (including search-param changes) can show the skeleton instantly.
export default function NewQuotationPage(props: PageProps<"/quotations/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewQuotationPageContent {...props} />
    </Suspense>
  );
}

async function NewQuotationPageContent({ searchParams }: PageProps<"/quotations/new">) {
  const { client, error } = await searchParams;
  return (
    <NewDocument
      type="quotation"
      preselected={typeof client === "string" ? client : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
