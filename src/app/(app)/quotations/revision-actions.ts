"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";

export interface RevisionState {
  error?: string;
  /** Bumped on every save so the form can reset itself. */
  saved?: number;
}

export async function logRevisionAction(quotationId: string, prev: RevisionState, formData: FormData): Promise<RevisionState> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "กรอกรายละเอียดที่แก้ไขในรอบนี้" };
  if (note.length > 1000) return { error: "รายละเอียดยาวเกิน 1,000 ตัวอักษร" };

  const { supabase, user, workspace } = await requireWorkspace();
  const { error } = await supabase
    .from("document_revisions")
    .insert({ workspace_id: workspace.id, document_id: quotationId, note, created_by: user.id });
  if (error) return { error: toThaiError(error) };

  revalidatePath(`/quotations/${quotationId}`);
  return { saved: (prev.saved ?? 0) + 1 };
}

export async function deleteRevisionAction(quotationId: string, revisionId: string): Promise<void> {
  const { supabase } = await requireWorkspace();
  await supabase.from("document_revisions").delete().eq("id", revisionId);
  revalidatePath(`/quotations/${quotationId}`);
}
