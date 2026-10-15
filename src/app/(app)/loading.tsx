// Per-page Suspense boundary: navigation shows this instantly while the page's
// session-dependent data streams in.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลด" className="animate-pulse">
      <div className="mb-6 h-8 w-48 rounded-lg bg-stone-200/70" />
      <div className="h-64 rounded-xl border border-stone-200 bg-white" />
    </div>
  );
}
