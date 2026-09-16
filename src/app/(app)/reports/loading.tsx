export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="space-y-1">
        <div className="h-6 w-28 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-4 w-64 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-10 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
