export default function TeamLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-6 w-24 bg-slate-200 rounded-lg" />
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white border border-slate-200 rounded-xl h-16" />)}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex items-center gap-4 px-5 py-4 ${i < 4 ? 'border-b border-slate-100' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-200 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
