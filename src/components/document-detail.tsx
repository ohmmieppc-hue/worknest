import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

// Layout shared by every issued document page.
//
//   wide screens                     phones / tablets
//   ┌──────────────┬────────┐        header
//   │              │primary │        primary   (next step, amounts)
//   │   document   │secondary        secondary (link, history — folded)
//   │              │ (sticky)        document
//   └──────────────┴────────┘
//
// The side column stays in view while the document scrolls, and scrolls on
// its own if it is taller than the screen. Printing keeps only the document.
export function DocumentDetail({
  back,
  title,
  badges,
  subtitle,
  toolbar,
  notices,
  primary,
  secondary,
  children,
}: {
  back: { href: string; label: string };
  title: string;
  badges: ReactNode;
  subtitle?: ReactNode;
  /** Print / PDF buttons, top right. */
  toolbar?: ReactNode;
  /** Shown above the document (void notice, change requests…). */
  notices?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="print:hidden">
        <Link href={back.href} className="text-sm text-stone-500 hover:text-stone-800">
          ← {back.label}
        </Link>
        <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {badges}
            </div>
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
          </div>
          {toolbar}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] print:block">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-1 [scrollbar-width:thin] print:hidden">
          {primary}
          {secondary}
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {notices && <div className="mb-4 space-y-3 print:hidden">{notices}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** A titled card for the side column. */
export function SidePanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Label / amount rows, e.g. an invoice's paid and outstanding amounts. */
export function AmountRows({ rows }: { rows: { label: string; value: string; strong?: boolean; tone?: "danger" | "muted" }[] }) {
  return (
    <dl className="divide-y divide-stone-100 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-stone-500">{r.label}</dt>
          <dd
            className={`tabular-nums ${r.strong ? "text-base font-semibold" : ""} ${r.tone === "danger" ? "text-red-700" : ""} ${
              r.tone === "muted" ? "text-stone-500" : ""
            }`}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
