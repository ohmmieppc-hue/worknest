"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { toThaiError } from "@/lib/errors";
import type { ActionResult } from "@/lib/documents";
import type { PaymentMethod, WhtCertStatus } from "@/lib/types";

export interface PaymentFormState {
  error?: string;
  saved?: number; // bumps on each success so the form can reset
}

const METHODS: PaymentMethod[] = ["transfer", "promptpay", "cash", "cheque", "other"];

function revalidateInvoice(invoiceId: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function recordPaymentAction(
  invoiceId: string,
  prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const cash = Number(text("cash_amount") || 0);
  const wht = Number(text("wht_amount") || 0);
  const method = text("method") as PaymentMethod;
  const incomeType = text("income_type");

  if (!text("received_on")) return { error: "ระบุวันที่รับเงิน" };
  if (!(cash >= 0) || !(wht >= 0)) return { error: "จำนวนเงินไม่ถูกต้อง" };
  if (cash + wht <= 0) return { error: "กรอกจำนวนเงินที่ได้รับ" };
  if (!METHODS.includes(method)) return { error: "เลือกช่องทางการชำระ" };

  const certStatus: WhtCertStatus = wht > 0 ? (formData.get("wht_cert_received") ? "received" : "pending") : "not_applicable";

  const { supabase, user, workspace } = await requireWorkspace();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      workspace_id: workspace.id,
      invoice_id: invoiceId,
      received_on: text("received_on"),
      cash_amount: cash,
      wht_amount: wht,
      method,
      reference: text("reference") || null,
      wht_cert_status: certStatus,
      income_type: incomeType === "40_2" || incomeType === "40_8" ? incomeType : null,
      note: text("note") || null,
      recorded_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: toThaiError(error) };

  if (formData.get("issue_receipt")) {
    const receipt = await supabase.rpc("issue_receipt_for_payment", { p_payment_id: data.id });
    if (receipt.error) {
      revalidateInvoice(invoiceId);
      return { error: `บันทึกการรับเงินแล้ว แต่ออกใบเสร็จไม่สำเร็จ: ${toThaiError(receipt.error)}` };
    }
  }

  revalidateInvoice(invoiceId);
  return { saved: (prev.saved ?? 0) + 1 };
}

export async function issueReceiptAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  const { supabase } = await requireWorkspace();
  const { error } = await supabase.rpc("issue_receipt_for_payment", { p_payment_id: paymentId });
  if (error) return { error: toThaiError(error) };
  revalidateInvoice(invoiceId);
  return {};
}

export async function markWhtCertReceivedAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  const { supabase } = await requireWorkspace();
  const { error } = await supabase.from("payments").update({ wht_cert_status: "received" }).eq("id", paymentId);
  if (error) return { error: toThaiError(error) };
  revalidateInvoice(invoiceId);
  return {};
}

// A payment can be removed only while it has no live receipt.
export async function deletePaymentAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  const { supabase } = await requireWorkspace();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, receipt:documents!payments_receipt_id_workspace_id_fkey(status)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "ไม่พบรายการรับเงิน" };
  const receipt = payment.receipt as unknown as { status: string } | null;
  if (receipt && receipt.status !== "void") return { error: "ยกเลิกใบเสร็จของรายการนี้ก่อน จึงจะลบรายการรับเงินได้" };

  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) return { error: toThaiError(error) };
  revalidateInvoice(invoiceId);
  return {};
}
