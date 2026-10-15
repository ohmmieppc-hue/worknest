import type { Metadata } from "next";
import { NewDocument } from "@/components/new-document";

export const metadata: Metadata = { title: "สร้างใบแจ้งหนี้" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const { client, error } = await searchParams;
  return (
    <NewDocument
      type="invoice"
      preselected={typeof client === "string" ? client : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
