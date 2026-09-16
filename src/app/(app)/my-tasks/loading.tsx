export default function MyTasksLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-slate-200 rounded-lg" />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 w-20 bg-slate-200 rounded" />
          ))}
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-xl" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="shrink-0 w-72 space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
            </div>
            {/* Progress bar */}
            <div className="h-1 bg-slate-100 rounded-full" />
            {/* Task cards */}
            {Array.from({ length: col === 0 ? 3 : 2 }).map((_, card) => (
              <div key={card} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 h-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
