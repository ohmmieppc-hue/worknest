import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/workspace";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { NavLinks } from "./nav-links";

// Large screens get a sidebar; phones and tablets keep a top bar whose links
// scroll sideways. The shell is static; anything that reads the session
// streams in behind a Suspense boundary (required with Cache Components).
export default function AppLayout({ children }: LayoutProps<"/">) {
  const logo = (
    <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
      Work<span className="text-brand-600">Nest</span>
    </Link>
  );
  const signOut = (className: string) => (
    <form action="/auth/signout" method="post">
      <button className={className}>ออกจากระบบ</button>
    </form>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white print:hidden lg:flex">
        <div className="px-6 py-5">{logo}</div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <NavLinks variant="side" />
        </div>
        <div className="border-t border-stone-200 p-3 text-sm">
          <Suspense fallback={<span className="mx-3 my-2 block h-4 w-28 animate-pulse rounded bg-stone-100" />}>
            <WorkspaceName className="block truncate px-3 py-2 font-medium text-stone-700" />
          </Suspense>
          {signOut("w-full rounded-lg px-3 py-2 text-left text-stone-500 hover:bg-stone-100 hover:text-stone-800")}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur print:hidden lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            {logo}
            {/* Phones: its own full-width row that scrolls sideways instead of wrapping words. */}
            <div className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:px-0">
              <NavLinks />
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Suspense fallback={<span className="h-4 w-28 animate-pulse rounded bg-stone-100" />}>
                <WorkspaceName className="hidden text-stone-500 sm:inline" />
              </Suspense>
              {signOut("rounded-lg px-2.5 py-1.5 text-stone-600 hover:bg-stone-100")}
            </div>
          </div>
        </header>
        {/* Pages stream behind ./loading.tsx */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 lg:px-8 print:max-w-none print:p-0">
          <ConfirmProvider>{children}</ConfirmProvider>
        </main>
      </div>
    </div>
  );
}

async function WorkspaceName({ className }: { className: string }) {
  const { user, workspace } = await requireWorkspace();
  return (
    <span className={className} title={user.email}>
      {workspace.display_name}
    </span>
  );
}
