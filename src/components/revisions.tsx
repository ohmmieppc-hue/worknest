import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import type { DocumentRevision } from "@/lib/types";

// "Used 2 of 3 revision rounds", shared by the owner page and the client portal.
export function RevisionCounter({ used, included }: { used: number; included: number | null }) {
  const over = included != null && used > included;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="text-2xl font-semibold tabular-nums">
        {used}
        {included != null && <span className="text-base font-normal text-stone-400"> / {included}</span>}
        <span className="ml-1 text-sm font-normal text-stone-500">รอบ</span>
      </p>
      {included == null ? (
        <p className="text-sm text-stone-500">ใบเสนอราคาไม่ได้ระบุจำนวนรอบแก้ไข</p>
      ) : over ? (
        <p className="text-sm font-medium text-amber-700">เกินที่ตกลงไว้ {used - included} รอบ (คิดค่าบริการเพิ่มได้)</p>
      ) : (
        <p className="text-sm text-stone-500">เหลืออีก {included - used} รอบ</p>
      )}
    </div>
  );
}

export function RevisionList({
  revisions,
  action,
}: {
  revisions: DocumentRevision[];
  /** Extra control per row, e.g. a delete button for the owner. */
  action?: (revision: DocumentRevision) => ReactNode;
}) {
  if (revisions.length === 0) return null;
  return (
    <ol className="divide-y divide-stone-100 text-sm">
      {revisions.map((r, i) => (
        <li key={r.id ?? i} className="flex items-start gap-3 py-2.5">
          <span className="w-14 shrink-0 text-stone-500">รอบที่ {i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-line">{r.note}</p>
            <p className="mt-0.5 text-xs text-stone-500">
              {formatDate(r.created_at)} · {r.requested_by === "client" ? "ลูกค้าขอผ่านใบส่งมอบงาน" : "บันทึกโดยผู้ให้บริการ"}
            </p>
          </div>
          {action?.(r)}
        </li>
      ))}
    </ol>
  );
}
