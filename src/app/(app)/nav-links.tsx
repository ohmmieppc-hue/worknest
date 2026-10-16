"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

// Outline icons (Heroicons style) shown next to the sidebar links.
const icon = (d: string) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-5 shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const LINKS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/dashboard", label: "ภาพรวม", icon: icon("M3.75 3.75h6.5v6.5h-6.5zM13.75 3.75h6.5v6.5h-6.5zM3.75 13.75h6.5v6.5h-6.5zM13.75 13.75h6.5v6.5h-6.5z") },
  {
    href: "/quotations",
    label: "ใบเสนอราคา",
    icon: icon("M19.5 14.25v-2.63a3.38 3.38 0 0 0-3.38-3.37h-1.5A1.13 1.13 0 0 1 13.5 7.13v-1.5A3.38 3.38 0 0 0 10.13 2.25H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.63c-.62 0-1.13.5-1.13 1.13v17.25c0 .62.5 1.12 1.13 1.12h12.75c.62 0 1.12-.5 1.12-1.12V11.25a9 9 0 0 0-9-9Z"),
  },
  {
    href: "/invoices",
    label: "ใบแจ้งหนี้",
    icon: icon("M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"),
  },
  {
    href: "/delivery-notes",
    label: "ส่งมอบงาน",
    icon: icon("M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"),
  },
  {
    href: "/clients",
    label: "ลูกค้า",
    icon: icon("M15 19.13a9.38 9.38 0 0 0 2.63.37 9.34 9.34 0 0 0 4.12-.95 4.13 4.13 0 0 0-7.53-2.49M15 19.13v-.01c0-1.11-.29-2.16-.79-3.07M15 19.13v.1A12.32 12.32 0 0 1 8.62 21c-2.33 0-4.51-.64-6.37-1.77v-.11a6.38 6.38 0 0 1 11.96-3.07M12 6.38a3.38 3.38 0 1 1-6.75 0 3.38 3.38 0 0 1 6.75 0Zm8.25 2.25a2.63 2.63 0 1 1-5.25 0 2.63 2.63 0 0 1 5.25 0Z"),
  },
  {
    href: "/services",
    label: "บริการ",
    icon: icon("M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.01v.01h-.01zM3.75 12h.01v.01h-.01zM3.75 17.25h.01v.01h-.01z"),
  },
  {
    href: "/settings",
    label: "ตั้งค่า",
    icon: icon("M9.59 3.94c.09-.54.56-.94 1.11-.94h2.6c.55 0 1.02.4 1.11.94l.21 1.28c.06.37.31.68.64.87l.22.13c.33.18.72.24 1.07.1l1.22-.45a1.13 1.13 0 0 1 1.37.49l1.3 2.25c.27.48.17 1.07-.25 1.43l-1 .83a1.13 1.13 0 0 0-.4.95v.25c.02.37.16.72.4.95l1 .83c.42.36.53.95.25 1.43l-1.3 2.25a1.13 1.13 0 0 1-1.37.49l-1.22-.45a1.13 1.13 0 0 0-1.07.1l-.22.13c-.33.19-.58.5-.64.87l-.21 1.28c-.09.54-.56.94-1.11.94h-2.6c-.55 0-1.02-.4-1.11-.94l-.21-1.28a1.13 1.13 0 0 0-.64-.87l-.22-.13a1.13 1.13 0 0 0-1.07-.1l-1.22.45a1.13 1.13 0 0 1-1.37-.49l-1.3-2.25a1.13 1.13 0 0 1 .25-1.43l1-.83c.24-.23.38-.58.4-.95v-.25a1.13 1.13 0 0 0-.4-.95l-1-.83a1.13 1.13 0 0 1-.25-1.43l1.3-2.25a1.13 1.13 0 0 1 1.37-.49l1.22.45c.35.14.74.08 1.07-.1l.22-.13c.33-.19.58-.5.64-.87l.21-1.28ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"),
  },
];

type Variant = "top" | "side";

// usePathname() is request data under Cache Components, so the active-state
// version streams in; the fallback renders the same links without highlight.
export function NavLinks({ variant = "top" }: { variant?: Variant }) {
  return (
    <Suspense fallback={<Links pathname={null} variant={variant} />}>
      <ActiveLinks variant={variant} />
    </Suspense>
  );
}

function ActiveLinks({ variant }: { variant: Variant }) {
  return <Links pathname={usePathname()} variant={variant} />;
}

function Links({ pathname, variant }: { pathname: string | null; variant: Variant }) {
  const side = variant === "side";
  return (
    <nav className={side ? "flex flex-col gap-0.5" : "flex gap-1"}>
      {LINKS.map(({ href, label, icon }) => {
        const active = pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-lg text-sm font-medium transition ${
              side ? "flex items-center gap-3 px-3 py-2" : "px-3 py-1.5"
            } ${active ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"}`}
          >
            {side && icon}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
