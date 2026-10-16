"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";

export interface ServiceFormState {
  error?: string;
  saved?: number;
}

function parse(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const price = Number(text("unit_price") || 0);
  if (!text("name")) return { error: "กรอกชื่อบริการ" } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "ราคาไม่ถูกต้อง" } as const;
  return {
    values: {
      name: text("name"),
      description: text("description") || null,
      unit: text("unit") || "งาน",
      unit_price: price,
    },
  } as const;
}

export async function saveServiceAction(id: string | null, prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, workspace } = await requireWorkspace();
  const { error } = id
    ? await supabase.from("service_items").update(parsed.values).eq("id", id)
    : await supabase.from("service_items").insert({ ...parsed.values, workspace_id: workspace.id });
  if (error) return { error: toThaiError(error) };

  revalidatePath("/services");
  return { saved: (prev.saved ?? 0) + 1 };
}

// Archived items stay linked to past documents but disappear from pickers.
export async function archiveServiceAction(id: string) {
  const { supabase } = await requireWorkspace();
  await supabase.from("service_items").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/services");
}
