import type { Metadata } from "next";
import { NewDocument } from "@/components/new-document";

export const metadata: Metadata = { title: "สร้างใบเสนอราคา" };

export default async function NewQuotationPage({ searchParams }: PageProps<"/quotations/new">) {
  const { client, error } = await searchParams;
  return (
    <NewDocument
      type="quotation"
      preselected={typeof client === "string" ? client : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
