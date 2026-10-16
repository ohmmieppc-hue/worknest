import Link from "next/link";
import type { ReactNode } from "react";

/** Compact list of related documents for a side panel. */
export function LinkedList({ rows }: { rows: { href: string; label: string; amount?: string; badge?: ReactNode }[] }) {
  return (
    <ul className="divide-y divide-stone-100 text-sm">
      {rows.map((r) => (
        <li key={r.href}>
          <Link href={r.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-stone-50">
            <span className="font-medium">{r.label}</span>
            <span className="flex items-center gap-3">
              {r.amount && <span className="tabular-nums">{r.amount}</span>}
              {r.badge}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
