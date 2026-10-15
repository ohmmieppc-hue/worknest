"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/dashboard", label: "ภาพรวม" },
  { href: "/quotations", label: "ใบเสนอราคา" },
  { href: "/invoices", label: "ใบแจ้งหนี้" },
  { href: "/clients", label: "ลูกค้า" },
  { href: "/settings", label: "ตั้งค่า" },
];

// usePathname() is request data under Cache Components, so the active-state
// version streams in; the fallback renders the same links without highlight.
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
