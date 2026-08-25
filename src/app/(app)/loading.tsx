// Global Suspense fallback — shown immediately when a (server-rendered,
// force-dynamic) page is loading, so slow navigations get instant feedback
// instead of a blank screen.
export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary" />
        <p className="text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}
