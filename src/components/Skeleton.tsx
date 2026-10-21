// Grey placeholder shown the moment a screen is opened, while its data arrives.
export function PageSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      {title && (
        <div className="space-y-2">
          <div className="h-7 w-64 rounded-lg bg-slate-200" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white ring-1 ring-slate-100" />)}
      </div>
      <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-100">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded-lg bg-slate-100" />)}
      </div>
    </div>
  );
}
