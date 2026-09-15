export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Header skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-52 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-32 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-8 w-28 bg-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 border-l-4 border-l-slate-200 rounded-2xl px-5 py-4 space-y-2">
            <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 h-64 animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-2xl p-5 h-64 animate-pulse" />
      </div>

      {/* Cards skeleton */}
      <div>
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 h-52 animate-pulse" />
          ))}
        </div>
      </div>

    </div>
  )
}
