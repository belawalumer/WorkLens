export default function MyTasksLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-6 w-28 bg-slate-200 rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-5 w-20 bg-slate-200 rounded-full" />)}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 bg-slate-200 rounded-lg" />
          <div className="h-9 w-24 bg-slate-200 rounded-lg" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl h-16" />
      ))}
    </div>
  )
}
