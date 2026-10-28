export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-4 animate-pulse">
    <div className="h-8 w-56 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="grid gap-3 sm:grid-cols-3">
      {[1, 2, 3].map(item => <div key={item} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700" />)}
    </div>
    <span className="sr-only">Loading workspace</span>
  </div>;
}
