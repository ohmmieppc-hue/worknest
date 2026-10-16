"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";
import { LOGO_MAX_BYTES, sniffImageType } from "@/lib/logo";

export interface SettingsState {
  error?: string;
  saved?: boolean;
}

export async function updateWorkspaceAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const digits = (key: string) => text(key).replace(/\D/g, "");

  const legalName = text("legal_name");
  const taxId = digits("tax_id");
  const branch = digits("branch_code") || "00000";
  const promptpay = digits("promptpay_id");
  const validDays = Number(text("default_quote_valid_days"));
  const creditDays = Number(text("default_credit_days"));

  if (!legalName) return { error: "กรอกชื่อบนเอกสาร" };
  if (taxId && taxId.length !== 13) return { error: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" };
  if (branch.length !== 5) return { error: "รหัสสาขาต้องเป็นตัวเลข 5 หลัก (สำนักงานใหญ่ = 00000)" };
  if (promptpay && ![10, 13].includes(promptpay.length)) {
    return { error: "พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลข 13 หลัก" };
  }
  const vatRegistered = formData.get("vat_registered") === "on";
  if (vatRegistered && !taxId) return { error: "ผู้จดทะเบียน VAT ต้องกรอกเลขประจำตัวผู้เสียภาษี 13 หลัก" };
  if (!Number.isInteger(validDays) || validDays < 1) return { error: "ระยะยืนราคาต้องเป็นจำนวนวันอย่างน้อย 1 วัน" };
  if (!Number.isInteger(creditDays) || creditDays < 0) return { error: "เครดิตเทอมต้องเป็นจำนวนวัน (0 ขึ้นไป)" };

  const bank = { bank: text("bank_name"), account_no: text("bank_account_no"), account_name: text("bank_account_name") };
  const bankAccounts = bank.bank || bank.account_no ? [bank] : [];

  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase
    .from("workspaces")
    .update({
      display_name: text("display_name") || legalName,
      legal_name: legalName,
      tax_id: taxId || null,
      branch_code: branch,
      address: text("address") || null,
      phone: text("phone") || null,
      email: text("email") || null,
      promptpay_id: promptpay || null,
      bank_accounts: bankAccounts,
      vat_registered: vatRegistered,
      default_quote_valid_days: validDays,
      default_credit_days: creditDays,
    })
    .eq("id", workspace.id);
  if (error) return { error: toThaiError(error) };

  revalidatePath("/", "layout");
  return { saved: true };
}

export interface LogoState {
  error?: string;
  saved?: boolean;
}

export async function uploadLogoAction(_prev: LogoState, formData: FormData): Promise<LogoState> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "เลือกไฟล์โลโก้ก่อน" };
  if (file.size > LOGO_MAX_BYTES) return { error: "ไฟล์ใหญ่เกิน 1MB" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) return { error: "รองรับเฉพาะไฟล์ PNG หรือ JPG" };

  const { supabase, user, workspace } = await requireWorkspace();
  const path = `${workspace.id}/${crypto.randomUUID()}.${mime === "image/png" ? "png" : "jpg"}`;

  const upload = await supabase.storage.from("logos").upload(path, bytes, { contentType: mime });
  if (upload.error) return { error: "อัปโหลดไม่สำเร็จ กรุณาลองใหม่" };

  const { data: row, error } = await supabase
    .from("files")
    .insert({
      workspace_id: workspace.id,
      kind: "logo",
      storage_path: path,
      mime_type: mime,
      size_bytes: bytes.length,
      original_name: file.name.slice(0, 200),
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("logos").remove([path]);
    return { error: toThaiError(error) };
  }

  const update = await supabase.from("workspaces").update({ logo_file_id: row.id }).eq("id", workspace.id);
  if (update.error) return { error: toThaiError(update.error) };

  revalidatePath("/", "layout");
  return { saved: true };
}

// Only unlinks the logo: issued documents may still point at the file.
export async function removeLogoAction(): Promise<void> {
  const { supabase, workspace } = await requireWorkspace();
  await supabase.from("workspaces").update({ logo_file_id: null }).eq("id", workspace.id);
  revalidatePath("/", "layout");
}
