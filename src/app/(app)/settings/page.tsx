import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireWorkspace } from "@/lib/workspace";
import { SettingsForm } from "./settings-form";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata: Metadata = { title: "ตั้งค่า" };

// The Suspense boundary lives inside the page so client navigations into this
// route can show the skeleton instantly.
export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}

async function SettingsPageContent() {
  const { workspace } = await requireWorkspace();

  return (
    <div className="max-w-4xl">
      <PageHeader title="ตั้งค่า" />
      <Card className="p-6">
        <SettingsForm workspace={workspace} />
      </Card>
    </div>
  );
}
