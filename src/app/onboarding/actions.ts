"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";

export interface OnboardingState {
  error?: string;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createWorkspaceAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { supabase, workspace } = await getSession();
  if (workspace) redirect("/dashboard");

  const legalName = text(formData, "legal_name");
  const displayName = text(formData, "display_name") || legalName;
  const taxId = text(formData, "tax_id").replace(/\D/g, "");
  const promptpay = text(formData, "promptpay_id").replace(/\D/g, "");

  if (!legalName) return { error: "กรอกชื่อที่จะแสดงบนเอกสาร" };
  if (taxId && taxId.length !== 13) return { error: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" };
  if (promptpay && ![10, 13].includes(promptpay.length)) {
    return { error: "พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลข 13 หลัก" };
  }

  const { data: id, error } = await supabase.rpc("create_workspace", {
    p_display_name: displayName,
    p_legal_name: legalName,
  });
  if (error) return { error: toThaiError(error) };

  const { error: updateError } = await supabase
    .from("workspaces")
    .update({
      tax_id: taxId || null,
      address: text(formData, "address") || null,
      phone: text(formData, "phone") || null,
      email: text(formData, "email") || null,
      promptpay_id: promptpay || null,
    })
    .eq("id", id);
  if (updateError) return { error: toThaiError(updateError) };

  redirect("/dashboard");
}
