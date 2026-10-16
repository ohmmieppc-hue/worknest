import Link from "next/link";
import type { ReactNode } from "react";

// Centered logo + card shared by the login, forgot-password and reset pages.
export function AuthCard({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            Work<span className="text-brand-600">Nest</span>
          </Link>
          <p className="mt-1 text-sm text-stone-500">ใบเสนอราคา ใบแจ้งหนี้ และลูกค้า ครบในที่เดียว</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
          {title && <h1 className="text-lg font-semibold">{title}</h1>}
          {description && <p className="mt-1 mb-5 text-sm text-stone-500">{description}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
