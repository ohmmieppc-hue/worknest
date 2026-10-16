"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, ErrorMessage, Field, inputClass } from "@/components/ui";
import { bahtText } from "@/lib/bahttext";
import { formatMoney } from "@/lib/format";
import { computeTotals, lineAmountCents } from "@/lib/totals";
import { DOC_META, type DraftHeader, type DraftItem, type DraftPayload } from "@/lib/documents";
import type { Client, DocumentItem, DocumentRow, ServiceItem } from "@/lib/types";
import { deleteDraftAction, issueDocumentAction, saveDraftAction } from "@/app/(app)/documents/actions";
import { useConfirm } from "@/components/confirm-dialog";

type Row = DraftItem & { key: string };

const num = (v: string | null | undefined) => (v == null ? "" : String(Number(v)));
const emptyRow = (): Row => ({ key: crypto.randomUUID(), description: "", quantity: "1", unit: "", unit_price: "", discount_amount: "" });

interface Props {
  doc: DocumentRow & { type: "quotation" | "invoice" | "delivery_note" };
  items: DocumentItem[];
  clients: Pick<Client, "id" | "name">[];
  services: ServiceItem[];
  /** The workspace is VAT-registered, so VAT can be charged. */
  vatRegistered?: boolean;
}

// Draft editor shared by quotations, invoices and delivery notes (which list
// what is handed over, without prices).
export function DocumentEditor({ doc, items, clients, services, vatRegistered = false }: Props) {
  const isQuotation = doc.type === "quotation";
  const isDelivery = doc.type === "delivery_note";
  const label = DOC_META[doc.type].label;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [savedAt, setSavedAt] = useState<string>();
  const confirm = useConfirm();

  const [header, setHeader] = useState<DraftHeader>({
    client_id: doc.client_id,
    title: doc.title ?? "",
    issue_date: doc.issue_date,
    valid_until: doc.valid_until ?? "",
    due_date: doc.due_date ?? "",
    discount_amount: Number(doc.discount_amount) ? num(doc.discount_amount) : "",
    vat_rate: num(doc.vat_rate),
    wht_rate: num(doc.wht_rate),
    scope_of_work: doc.scope_of_work ?? "",
    exclusions: doc.exclusions ?? "",
    revisions_included: doc.revisions_included?.toString() ?? "",
    payment_terms: doc.payment_terms ?? "",
    notes: doc.notes ?? "",
  });
  const [rows, setRows] = useState<Row[]>(() =>
    items.length
      ? items.map((i) => ({
          key: i.id,
          service_item_id: i.service_item_id ?? undefined,
          description: i.description,
          quantity: num(i.quantity),
          unit: i.unit ?? "",
          unit_price: num(i.unit_price),
          discount_amount: Number(i.discount_amount) ? num(i.discount_amount) : "",
        }))
      : [emptyRow()],
  );

  const set = (key: keyof DraftHeader) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setHeader((h) => ({ ...h, [key]: e.target.value }));

  const updateRow = (key: string, patch: Partial<DraftItem>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [emptyRow()]));
  // Fill the trailing empty row if there is one, otherwise append.
  const addService = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    const row: Row = {
      key: crypto.randomUUID(),
      service_item_id: s.id,
      description: s.description ? `${s.name}
${s.description}` : s.name,
      quantity: "1",
      unit: s.unit,
      unit_price: num(s.unit_price),
      discount_amount: "",
    };
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return last && !last.description.trim() && !last.unit_price ? [...rs.slice(0, -1), row] : [...rs, row];
    });
  };
  const moveRow = (index: number, delta: number) =>
    setRows((rs) => {
      const next = [...rs];
      const target = index + delta;
      if (target < 0 || target >= next.length) return rs;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const activeRows = rows.filter((r) => r.description.trim());
  const totals = computeTotals(activeRows, { discount: header.discount_amount, whtRate: header.wht_rate, vatRate: header.vat_rate });
  const hasVat = Number(header.vat_rate) > 0;

  const payload = (): DraftPayload => ({
    header: isDelivery ? { ...header, vat_rate: "0" } : header,
    items: rows.map((r) => ({
      service_item_id: r.service_item_id,
      description: r.description,
      quantity: r.quantity,
      unit: r.unit,
      unit_price: isDelivery ? "0" : r.unit_price,
      discount_amount: isDelivery ? "0" : r.discount_amount,
    })),
  });

  function run(action: () => Promise<{ error?: string }>, onSuccess?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  const save = () =>
    run(
      () => saveDraftAction(doc.type, doc.id, payload()),
      () => setSavedAt(new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })),
    );

  const issue = async () => {
    const ok = await confirm({
      title: `ออก${label}?`,
      description: "เมื่อออกแล้วจะได้เลขที่เอกสารและแก้ไขไม่ได้ ถ้าต้องแก้ต้องยกเลิกแล้วออกฉบับใหม่",
      confirmLabel: `ออก${label}`,
    });
    if (!ok) return;
    run(() => issueDocumentAction(doc.type, doc.id, payload()));
  };

  const remove = async () => {
    const ok = await confirm({ title: `ลบร่าง${label}นี้?`, description: "ร่างที่ลบแล้วกู้คืนไม่ได้", confirmLabel: "ลบร่าง", tone: "danger" });
    if (!ok) return;
    run(() => deleteDraftAction(doc.type, doc.id));
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="ลูกค้า" className="sm:col-span-2">
            <select value={header.client_id} onChange={set("client_id")} className={inputClass}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="วันที่ออก">
            <input type="date" value={header.issue_date} onChange={set("issue_date")} className={inputClass} />
          </Field>
          {isDelivery ? null : isQuotation ? (
            <Field label="ยืนราคาถึง">
              <input type="date" value={header.valid_until} onChange={set("valid_until")} className={inputClass} />
            </Field>
          ) : (
            <Field label="ครบกำหนดชำระ">
              <input type="date" value={header.due_date} onChange={set("due_date")} className={inputClass} />
            </Field>
          )}
          <Field label="ชื่องาน" className="sm:col-span-2 lg:col-span-4">
            <input
              value={header.title}
              onChange={set("title")}
              placeholder="เช่น ออกแบบเว็บไซต์บริษัท"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="font-semibold">{isDelivery ? "งานที่ส่งมอบ" : "รายการ"}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${isDelivery ? "min-w-[520px]" : "min-w-[720px]"}`}>
            <thead className="bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="w-8 px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">รายละเอียด</th>
                <th className="w-20 px-2 py-2 text-right font-medium">จำนวน</th>
                <th className="w-24 px-2 py-2 font-medium">หน่วย</th>
                {!isDelivery && (
                  <>
                    <th className="w-32 px-2 py-2 text-right font-medium">ราคา/หน่วย</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">ส่วนลด</th>
                    <th className="w-32 px-2 py-2 text-right font-medium">จำนวนเงิน</th>
                  </>
                )}
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r, index) => (
                <tr key={r.key} className="align-top">
                  <td className="px-2 py-2 pt-4 text-xs text-stone-400">{index + 1}</td>
                  <td className="px-2 py-2">
                    <textarea
                      rows={1}
                      value={r.description}
                      onChange={(e) => updateRow(r.key, { description: e.target.value })}
                      placeholder="รายละเอียดงาน"
                      aria-label={`รายละเอียดรายการที่ ${index + 1}`}
                      className={`${inputClass} field-sizing-content min-h-[38px] resize-none`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={r.quantity}
                      onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                      aria-label="จำนวน"
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={r.unit}
                      onChange={(e) => updateRow(r.key, { unit: e.target.value })}
                      placeholder="งาน"
                      aria-label="หน่วย"
                      className={inputClass}
                    />
                  </td>
                  {!isDelivery && (
                    <>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={r.unit_price}
                          onChange={(e) => updateRow(r.key, { unit_price: e.target.value })}
                          placeholder="0.00"
                          aria-label="ราคาต่อหน่วย"
                          className={`${inputClass} text-right`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={r.discount_amount}
                          onChange={(e) => updateRow(r.key, { discount_amount: e.target.value })}
                          placeholder="0.00"
                          aria-label="ส่วนลด"
                          className={`${inputClass} text-right`}
                        />
                      </td>
                      <td className="px-2 py-2 pt-4 text-right tabular-nums">
                        {formatMoney(lineAmountCents(r) / 100)}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 pt-3 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      aria-label="เลื่อนขึ้น"
                      className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      aria-label="ลบรายการ"
                      className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            + เพิ่มรายการ
          </Button>
          {services.length > 0 ? (
            <select
              value=""
              onChange={(e) => addService(e.target.value)}
              aria-label="เพิ่มจากรายการบริการ"
              className={`${inputClass} w-auto max-w-xs`}
            >
              <option value="">+ เพิ่มจากรายการบริการ…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {isDelivery ? s.name : `${s.name} · ${formatMoney(s.unit_price)}/${s.unit}`}
                </option>
              ))}
            </select>
          ) : (
            <Link href="/services" className="text-sm text-stone-500 hover:text-brand-700 hover:underline">
              บันทึกบริการที่ทำประจำไว้เลือกใช้ซ้ำ →
            </Link>
          )}
        </div>

        {!isDelivery && (
          <div className="grid gap-6 border-t border-stone-200 bg-stone-50/60 p-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3 self-start">
              <Field label="ส่วนลดท้ายบิล (บาท)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={header.discount_amount}
                  onChange={set("discount_amount")}
                  placeholder="0.00"
                  className={`${inputClass} text-right`}
                />
              </Field>
              <Field label="หัก ณ ที่จ่าย (%)" hint="ค่าบริการทั่วไป 3%">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  inputMode="decimal"
                  value={header.wht_rate}
                  onChange={set("wht_rate")}
                  className={`${inputClass} text-right`}
                />
              </Field>
              {/* Shown when registered, or to let an old VAT draft be switched off. */}
              {(vatRegistered || hasVat) && (
                <label className="col-span-2 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasVat}
                    onChange={(e) => setHeader((h) => ({ ...h, vat_rate: e.target.checked ? "7" : "0" }))}
                    className="mt-0.5 size-4 shrink-0 accent-brand-600"
                  />
                  <span>
                    คิดภาษีมูลค่าเพิ่ม 7%
                    {hasVat && doc.type === "invoice" && (
                      <span className="block text-xs text-stone-500">ใบเสร็จที่ออกตอนรับเงินจะเป็นใบเสร็จรับเงิน/ใบกำกับภาษี</span>
                    )}
                  </span>
                </label>
              )}
            </div>

            <dl className="space-y-1.5 text-sm">
              <TotalRow label="รวมเป็นเงิน" value={totals.subtotal} />
              {totals.discount > 0 && <TotalRow label="ส่วนลด" value={-totals.discount} />}
              {hasVat && <TotalRow label={`ภาษีมูลค่าเพิ่ม ${Number(header.vat_rate)}%`} value={totals.vat} />}
              <TotalRow label="ยอดรวมทั้งสิ้น" value={totals.total} strong />
              {totals.wht > 0 && (
                <>
                  <TotalRow label={`หัก ณ ที่จ่าย ${Number(header.wht_rate)}%`} value={-totals.wht} muted />
                  <TotalRow label="ยอดชำระสุทธิ" value={totals.payable} strong />
                </>
              )}
              <p className="pt-1 text-right text-xs text-stone-500">({bahtText(totals.wht > 0 ? totals.payable : totals.total)})</p>
              {totals.discountTooLarge && <p className="text-right text-xs text-red-600">ส่วนลดมากกว่ายอดรวม</p>}
            </dl>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-semibold">{isQuotation ? "ขอบเขตงานและเงื่อนไข" : isDelivery ? "รายละเอียดการส่งมอบ" : "เงื่อนไขและหมายเหตุ"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {isQuotation && (
            <>
              <Field label="ขอบเขตงาน (Scope of Work)" className="sm:col-span-2">
                <textarea
                  rows={4}
                  value={header.scope_of_work}
                  onChange={set("scope_of_work")}
                  placeholder="สิ่งที่ส่งมอบ เช่น ออกแบบ 5 หน้า, ไฟล์ Figma, ติดตั้งบน hosting ของลูกค้า"
                  className={inputClass}
                />
              </Field>
              <Field label="สิ่งที่ไม่รวมในราคา" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={header.exclusions}
                  onChange={set("exclusions")}
                  placeholder="เช่น ค่าโดเมน/โฮสติ้ง, การเขียนเนื้อหา, รูปภาพลิขสิทธิ์"
                  className={inputClass}
                />
              </Field>
              <Field label="จำนวนรอบแก้ไขที่รวมในราคา">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={header.revisions_included}
                  onChange={set("revisions_included")}
                  placeholder="เช่น 2"
                  className={inputClass}
                />
              </Field>
            </>
          )}
          {!isDelivery && (
            <Field label="เงื่อนไขการชำระเงิน" className={isQuotation ? undefined : "sm:col-span-2"}>
              <input
                value={header.payment_terms}
                onChange={set("payment_terms")}
                placeholder="เช่น มัดจำ 50% ก่อนเริ่มงาน ส่วนที่เหลือเมื่อส่งมอบ"
                className={inputClass}
              />
            </Field>
          )}
          <Field label={isDelivery ? "รายละเอียด / ลิงก์ไฟล์งาน" : "หมายเหตุ"} className="sm:col-span-2">
            <textarea
              rows={isDelivery ? 4 : 2}
              value={header.notes}
              onChange={set("notes")}
              placeholder={isDelivery ? "เช่น ลิงก์ Google Drive ของไฟล์งาน, วิธีติดตั้ง, รหัสเข้าระบบที่ส่งแยก" : undefined}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {error && (
          <div className="mb-3">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={issue} disabled={pending || totals.discountTooLarge}>
            ออก{label}
          </Button>
          <Button type="button" variant="secondary" onClick={save} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึกร่าง"}
          </Button>
          {savedAt && !pending && <span className="text-sm text-stone-500">บันทึกแล้ว {savedAt}</span>}
          <Button type="button" variant="danger" onClick={remove} disabled={pending} className="ml-auto">
            ลบร่าง
          </Button>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""} ${muted ? "text-stone-500" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}
