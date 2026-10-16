"use client";

import { Button, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { installmentAmount, scheduleMismatch } from "@/lib/schedule";
import type { DraftScheduleRow } from "@/lib/documents";

export type ScheduleDraft = DraftScheduleRow & { key: string; unit: "percent" | "amount" };

const newRow = (label = "", percent = ""): ScheduleDraft => ({
  key: crypto.randomUUID(),
  label,
  unit: "percent",
  percent,
  amount: "",
  due_rule: "manual",
  due_date: "",
});

const PRESETS: { name: string; rows: [string, string][] }[] = [
  { name: "50 / 50", rows: [["มัดจำก่อนเริ่มงาน", "50"], ["ส่วนที่เหลือเมื่อส่งมอบงาน", "50"]] },
  { name: "40 / 40 / 20", rows: [["มัดจำก่อนเริ่มงาน", "40"], ["เมื่อส่งงานรอบแรก", "40"], ["เมื่อส่งมอบงานทั้งหมด", "20"]] },
  { name: "30 / 40 / 30", rows: [["มัดจำก่อนเริ่มงาน", "30"], ["เมื่อส่งงานครึ่งทาง", "40"], ["เมื่อส่งมอบงานทั้งหมด", "30"]] },
];

/** Installment rows for a quotation draft; amounts are shares of the pre-VAT total. */
export function ScheduleEditor({ rows, onChange, base }: { rows: ScheduleDraft[]; onChange: (rows: ScheduleDraft[]) => void; base: number }) {
  const update = (key: string, patch: Partial<ScheduleDraft>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const asRow = (r: ScheduleDraft) => ({ percent: r.unit === "percent" ? r.percent : null, amount: r.unit === "amount" ? r.amount : null });
  const active = rows.filter((r) => r.label.trim());
  const mismatch = scheduleMismatch(active.map(asRow), base);
  const sum = active.reduce((s, r) => s + installmentAmount(asRow(r), base), 0);

  const applyPreset = (preset: (typeof PRESETS)[number]) =>
    onChange(
      preset.rows.map(([label, percent], i) => ({ ...newRow(label, percent), due_rule: i === 0 ? "on_accept" : "manual" })),
    );

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">แบ่งชำระเป็นงวด:</span>
          {PRESETS.map((p) => (
            <Button key={p.name} type="button" variant="secondary" onClick={() => applyPreset(p)}>
              {p.name}
            </Button>
          ))}
          <Button type="button" variant="ghost" onClick={() => onChange([newRow()])}>
            + กำหนดเอง
          </Button>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-[1fr_9rem_11rem_auto] sm:items-start">
                <input
                  value={r.label}
                  onChange={(e) => update(r.key, { label: e.target.value })}
                  placeholder={`งวดที่ ${i + 1} เช่น มัดจำก่อนเริ่มงาน`}
                  aria-label={`ชื่องวดที่ ${i + 1}`}
                  className={inputClass}
                />
                <div className="flex">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={r.unit === "percent" ? r.percent : r.amount}
                    onChange={(e) => update(r.key, r.unit === "percent" ? { percent: e.target.value } : { amount: e.target.value })}
                    aria-label="สัดส่วนหรือจำนวนเงิน"
                    className={`${inputClass} rounded-r-none text-right`}
                  />
                  <select
                    value={r.unit}
                    onChange={(e) => update(r.key, { unit: e.target.value as ScheduleDraft["unit"] })}
                    aria-label="หน่วย"
                    className={`${inputClass} w-16 rounded-l-none border-l-0 px-2`}
                  >
                    <option value="percent">%</option>
                    <option value="amount">บาท</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <select
                    value={r.due_rule}
                    onChange={(e) => update(r.key, { due_rule: e.target.value as ScheduleDraft["due_rule"] })}
                    aria-label="เรียกเก็บเมื่อ"
                    className={inputClass}
                  >
                    <option value="on_accept">เมื่อตอบรับ</option>
                    <option value="manual">ตามเงื่อนไขในชื่องวด</option>
                    <option value="fixed_date">ภายในวันที่</option>
                  </select>
                  {r.due_rule === "fixed_date" && (
                    <input
                      type="date"
                      value={r.due_date}
                      onChange={(e) => update(r.key, { due_date: e.target.value })}
                      aria-label="วันที่ครบกำหนดของงวด"
                      className={inputClass}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end sm:pt-2">
                  <span className="text-sm text-stone-500 tabular-nums sm:hidden">{formatMoney(installmentAmount(asRow(r), base))}</span>
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                    aria-label={`ลบงวดที่ ${i + 1}`}
                    className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Button type="button" variant="ghost" onClick={() => onChange([...rows, newRow()])}>
              + เพิ่มงวด
            </Button>
            <span className={mismatch ? "font-medium text-red-600" : "text-stone-600"}>
              รวม {formatMoney(sum)} จาก {formatMoney(base)} บาท
              {base > 0 && ` (${Math.round((sum / base) * 10000) / 100}%)`}
              {mismatch && " — ต้องรวมให้ครบ 100%"}
            </span>
          </div>
          <p className="text-xs text-stone-500">ยอดแต่ละงวดคิดจากยอดก่อน VAT และก่อนหัก ณ ที่จ่าย ใบแจ้งหนี้ของแต่ละงวดจะคิดภาษีให้เอง</p>
        </>
      )}
    </div>
  );
}

export const toScheduleDraft = (r: DraftScheduleRow & { key?: string }): ScheduleDraft => ({
  ...r,
  key: r.key ?? crypto.randomUUID(),
  unit: r.amount && !r.percent ? "amount" : "percent",
});
