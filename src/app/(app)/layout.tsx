import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/workspace";
import { NavLinks } from "./nav-links";

// The header shell is static; anything that reads the session streams in
// behind a Suspense boundary (required with Cache Components).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Work<span className="text-brand-600">Nest</span>
          </Link>
          {/* Phones: its own full-width row that scrolls sideways instead of wrapping words. */}
          <div className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:px-0">
            <NavLinks />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Suspense fallback={<span className="h-4 w-28 animate-pulse rounded bg-stone-100" />}>
              <WorkspaceName />
            </Suspense>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg px-2.5 py-1.5 text-stone-600 hover:bg-stone-100">ออกจากระบบ</button>
            </form>
          </div>
        </div>
      </header>
      {/* Pages stream behind ./loading.tsx */}
      <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

async function WorkspaceName() {
  const { user, workspace } = await requireWorkspace();
  return (
    <span className="hidden text-stone-500 sm:inline" title={user.email}>
      {workspace.display_name}
    </span>
  );
}
