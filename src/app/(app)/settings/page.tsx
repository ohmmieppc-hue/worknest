import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireWorkspace } from "@/lib/workspace";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
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
