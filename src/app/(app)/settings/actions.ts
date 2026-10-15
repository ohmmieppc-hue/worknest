"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";

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
      default_quote_valid_days: validDays,
      default_credit_days: creditDays,
    })
    .eq("id", workspace.id);
  if (error) return { error: toThaiError(error) };

  revalidatePath("/", "layout");
  return { saved: true };
}
