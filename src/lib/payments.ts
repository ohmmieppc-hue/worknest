import type { DocumentRow, InvoiceBalance, PaymentMethod } from "@/lib/types";

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  transfer: "โอนเงิน",
  promptpay: "พร้อมเพย์",
  cash: "เงินสด",
  cheque: "เช็ค",
  other: "อื่น ๆ",
};

const cents = (v: string | number) => Math.round(Number(v) * 100);

/**
 * What the client still has to settle, split into the cash to transfer and the
 * tax they will withhold. Withholding is capped at what the invoice expects
 * minus what was already withheld on earlier payments.
 */
export function amountsDue(doc: Pick<DocumentRow, "wht_amount">, balance: Pick<InvoiceBalance, "outstanding" | "wht_withheld">) {
  const outstanding = Math.max(0, cents(balance.outstanding));
  const whtDue = Math.min(outstanding, Math.max(0, cents(doc.wht_amount) - cents(balance.wht_withheld)));
  return { outstanding: outstanding / 100, whtDue: whtDue / 100, cashDue: (outstanding - whtDue) / 100 };
}
