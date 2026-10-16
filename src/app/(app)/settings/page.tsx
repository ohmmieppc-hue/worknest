import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireWorkspace } from "@/lib/workspace";
import { SettingsForm } from "./settings-form";
import { LogoForm } from "./logo-form";
import { logoUrl } from "@/lib/logo";
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
  const { supabase, workspace } = await requireWorkspace();
  const { data: logo } = workspace.logo_file_id
    ? await supabase.from("files").select("storage_path").eq("id", workspace.logo_file_id).maybeSingle()
    : { data: null };

  return (
    <div className="max-w-4xl">
      <PageHeader title="ตั้งค่า" />
      <Card className="mb-6 p-6">
        <LogoForm key={logo?.storage_path ?? "none"} logoUrl={logoUrl(logo?.storage_path)} />
      </Card>
      <Card className="p-6">
        <SettingsForm workspace={workspace} />
      </Card>
    </div>
  );
}
