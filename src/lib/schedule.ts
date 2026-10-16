import { formatDate } from "@/lib/format";
import type { DocumentRow, ScheduleRow } from "@/lib/types";

// Installments are shares of the quotation's pre-VAT amount (subtotal minus
// the bill discount). Each one becomes an invoice, which then adds VAT and
// withholding tax the same way as any other invoice.

export const scheduleBase = (doc: Pick<DocumentRow, "subtotal" | "discount_amount">) =>
  Number(doc.subtotal) - Number(doc.discount_amount);

export function installmentAmount(row: Pick<ScheduleRow, "percent" | "amount">, base: number) {
  if (row.percent != null && row.percent !== "") return Math.round(base * Number(row.percent)) / 100;
  return Number(row.amount) || 0;
}

export function installmentPercent(row: Pick<ScheduleRow, "percent" | "amount">, base: number) {
  if (row.percent != null && row.percent !== "") return Number(row.percent);
  return base > 0 ? ((Number(row.amount) || 0) / base) * 100 : 0;
}

export const dueRuleLabel: Record<ScheduleRow["due_rule"], string> = {
  on_accept: "เมื่อตอบรับใบเสนอราคา",
  manual: "ตามเงื่อนไขที่ระบุ",
  fixed_date: "ภายในวันที่",
  on_milestone: "เมื่อส่งงานตามรอบ",
};

export function dueText(row: Pick<ScheduleRow, "due_rule" | "due_date">) {
  return row.due_rule === "fixed_date" ? `${dueRuleLabel.fixed_date} ${formatDate(row.due_date)}` : dueRuleLabel[row.due_rule];
}

/** Installments must add up to the whole pre-VAT amount, allowing a satang per row for rounding. */
export function scheduleMismatch(rows: Pick<ScheduleRow, "percent" | "amount">[], base: number) {
  if (rows.length === 0) return null;
  const sum = rows.reduce((s, r) => s + installmentAmount(r, base), 0);
  return Math.abs(sum - base) <= 0.01 * rows.length ? null : { sum, base };
}
