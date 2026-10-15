import { Card, EmptyState, ErrorMessage, Field, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { DOC_META } from "@/lib/documents";
import { requireWorkspace } from "@/lib/workspace";
import type { Client } from "@/lib/types";
import { createDocumentAction } from "@/app/(app)/documents/actions";

interface Props {
  type: "quotation" | "invoice";
  preselected?: string;
  error?: string;
}

// Step 1 of a new quotation / invoice: pick the client, then edit the draft.
export async function NewDocument({ type, preselected, error }: Props) {
  const label = DOC_META[type].label;
  const { supabase } = await requireWorkspace();
  const { data } = await supabase.from("clients").select("id, name, status").is("archived_at", null).order("name");
  const clients = (data ?? []) as Pick<Client, "id" | "name" | "status">[];
  const newClientHref = `/clients/new?next=${type}`;

  return (
    <div className="max-w-xl">
      <PageHeader title={`สร้าง${label}`} description="เลือกลูกค้า แล้วกรอกรายการในขั้นถัดไป" />
      <Card className="p-6">
        {clients.length === 0 ? (
          <EmptyState
            title="ยังไม่มีลูกค้า"
            description={`เพิ่มลูกค้าก่อน แล้วระบบจะพากลับมาสร้าง${label}ให้`}
            action={<LinkButton href={newClientHref}>+ เพิ่มลูกค้า</LinkButton>}
          />
        ) : (
          <form action={createDocumentAction.bind(null, type)} className="space-y-4">
            <Field label="ลูกค้า">
              <select name="client_id" required defaultValue={preselected ?? ""} className={inputClass}>
                <option value="" disabled>
                  — เลือกลูกค้า —
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === "lead" ? " (Lead)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {error && <ErrorMessage>{error === "client" ? "ไม่พบลูกค้าที่เลือก" : error}</ErrorMessage>}
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton pendingText="กำลังสร้าง…">สร้างร่าง{label}</SubmitButton>
              <LinkButton href={newClientHref} variant="ghost">
                + ลูกค้าใหม่
              </LinkButton>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
