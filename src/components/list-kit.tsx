import Link from "next/link";
import type { ReactNode } from "react";
import { Card, inputClass } from "@/components/ui";
import { PAGE_SIZE, listHref, type ListParams } from "@/lib/list";

// Building blocks every list page shares, in page order:
// StatGrid → ListToolbar (search) → TabNav → DataList → Pagination.

type Tone = "default" | "danger" | "warning" | "success";

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}

const statTone: Record<Tone, string> = {
  default: "",
  danger: "border-red-200 bg-red-50/40",
  warning: "border-amber-200 bg-amber-50/40",
  success: "border-emerald-200 bg-emerald-50/40",
};
const valueTone: Record<Tone, string> = {
  default: "",
  danger: "text-red-700",
  warning: "text-amber-800",
  success: "text-emerald-700",
};

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className={`p-4 ${statTone[s.tone ?? "default"]}`}>
          <p className="text-xs text-stone-500 sm:text-sm">{s.label}</p>
          <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-2xl ${valueTone[s.tone ?? "default"]}`}>{s.value}</p>
          {s.hint && <p className="mt-0.5 text-xs text-stone-500">{s.hint}</p>}
        </Card>
      ))}
    </div>
  );
}

/** GET form: searching keeps the current tab and starts again from page 1. */
export function ListToolbar({
  path,
  params,
  placeholder,
  children,
}: {
  path: string;
  params: ListParams;
  placeholder: string;
  /** Extra filters (selects) submitted with the search. */
  children?: ReactNode;
}) {
  return (
    <form action={path} className="mb-4 flex flex-wrap items-center gap-2">
      {params.tab && params.tab !== "all" && <input type="hidden" name="tab" value={params.tab} />}
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
        <input type="search" name="q" defaultValue={params.q} placeholder={placeholder} aria-label="ค้นหา" className={`${inputClass} pl-9`} />
      </div>
      {children}
      <button className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium shadow-xs hover:bg-stone-50">ค้นหา</button>
      {params.q && (
        <Link href={listHref(path, { tab: params.tab })} className="text-sm text-stone-500 hover:text-stone-800 hover:underline">
          ล้าง
        </Link>
      )}
    </form>
  );
}

export function TabNav({
  path,
  params,
  tabs,
}: {
  path: string;
  params: ListParams;
  tabs: { key: string; label: string; count?: number }[];
}) {
  const current = tabs.some((t) => t.key === params.tab) ? params.tab : tabs[0].key;
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-200 [scrollbar-width:none]">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={listHref(path, { tab: t.key, q: params.q })}
          aria-current={t.key === current ? "page" : undefined}
          className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
            t.key === current ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className="rounded-full bg-stone-100 px-1.5 text-xs font-normal text-stone-600 tabular-nums">{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
}

export interface MobileCard {
  title: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  amount?: ReactNode;
}

/** A table on wider screens and tappable cards on phones. */
export function DataList<T extends { id: string }>({
  rows,
  columns,
  href,
  mobile,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  href: (row: T) => string;
  mobile: (row: T) => MobileCard;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <Card>{empty}</Card>;
  return (
    <>
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => {
          const card = mobile(row);
          return (
            <li key={row.id}>
              <Link href={href(row)} className="block rounded-xl border border-stone-200 bg-white p-4 shadow-xs active:bg-stone-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium">{card.title}</p>
                  {card.badge}
                </div>
                {card.subtitle && <div className="mt-0.5 text-sm text-stone-600">{card.subtitle}</div>}
                {(card.meta || card.amount) && (
                  <div className="mt-2 flex items-end justify-between gap-3 text-sm">
                    <span className="text-stone-500">{card.meta}</span>
                    <span className="font-medium tabular-nums">{card.amount}</span>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <Card className="hidden overflow-hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id} className="group relative hover:bg-stone-50">
                  {columns.map((c, i) => (
                    <td key={c.header} className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                      {i === 0 ? (
                        // The first cell's link covers the whole row.
                        <Link href={href(row)} className="font-medium group-hover:text-brand-700 after:absolute after:inset-0">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function Pagination({ path, params, total }: { path: string; params: ListParams; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  const from = (params.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(params.page * PAGE_SIZE, total);
  const link = (page: number) => listHref(path, { tab: params.tab, q: params.q, page });
  const btn = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-stone-50";
  const off = "rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-300";

  // A stale link (e.g. page 5 after a search narrowed the list).
  if (from > total) {
    return (
      <p className="mt-4 text-sm text-stone-500">
        ไม่มีหน้านี้แล้ว ·{" "}
        <Link href={link(1)} className="font-medium text-brand-700 hover:underline">
          กลับไปหน้าแรก
        </Link>
      </p>
    );
  }

  return (
    <nav aria-label="เลือกหน้า" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
      <span>
        แสดง {from.toLocaleString("th-TH")}–{to.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {params.page > 1 ? (
            <Link href={link(params.page - 1)} className={btn}>
              ← ก่อนหน้า
            </Link>
          ) : (
            <span className={off}>← ก่อนหน้า</span>
          )}
          <span className="tabular-nums">
            หน้า {params.page} / {pages}
          </span>
          {params.page < pages ? (
            <Link href={link(params.page + 1)} className={btn}>
              ถัดไป →
            </Link>
          ) : (
            <span className={off}>ถัดไป →</span>
          )}
        </div>
      )}
    </nav>
  );
}
