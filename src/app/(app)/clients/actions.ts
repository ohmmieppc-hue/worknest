"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";
import type { ClientKind, ClientStatus } from "@/lib/types";

export interface ClientFormState {
  error?: string;
  saved?: boolean;
}

const KINDS: ClientKind[] = ["individual", "company"];
const STATUSES: ClientStatus[] = ["lead", "active", "inactive"];

function parseClient(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const kind = text("kind") as ClientKind;
  const status = text("status") as ClientStatus;
  const taxId = text("tax_id").replace(/\D/g, "");
  const branch = text("branch_code").replace(/\D/g, "");
  const wht = Number(text("default_wht_rate") || 0);

  if (!text("name")) return { error: "กรอกชื่อลูกค้า" } as const;
  if (!KINDS.includes(kind) || !STATUSES.includes(status)) return { error: "ข้อมูลไม่ถูกต้อง" } as const;
  if (taxId && taxId.length !== 13) return { error: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" } as const;
  if (branch && branch.length !== 5) return { error: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก (สำนักงานใหญ่ = 00000)" } as const;
  if (!Number.isFinite(wht) || wht < 0 || wht > 100) return { error: "อัตราหัก ณ ที่จ่ายไม่ถูกต้อง" } as const;

  return {
    values: {
      kind,
      status,
      name: text("name"),
      tax_id: taxId || null,
      branch_code: kind === "company" && taxId ? branch || "00000" : null,
      address: text("address") || null,
      email: text("email") || null,
      phone: text("phone") || null,
      default_wht_rate: wht,
      source: text("source") || null,
      notes: text("notes") || null,
    },
  } as const;
}

export async function createClientAction(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const parsed = parseClient(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, workspace } = await requireWorkspace();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.values, workspace_id: workspace.id })
    .select("id")
    .single();
  if (error) return { error: toThaiError(error) };

  revalidatePath("/clients");
  const next = String(formData.get("next") ?? "");
  if (next === "quotation") redirect(`/quotations/new?client=${data.id}`);
  if (next === "invoice") redirect(`/invoices/new?client=${data.id}`);
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = parseClient(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase } = await requireWorkspace();
  const { error } = await supabase.from("clients").update(parsed.values).eq("id", id);
  if (error) return { error: toThaiError(error) };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { saved: true };
}

export async function archiveClientAction(id: string) {
  const { supabase } = await requireWorkspace();
  await supabase.from("clients").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/clients");
  redirect("/clients");
}
