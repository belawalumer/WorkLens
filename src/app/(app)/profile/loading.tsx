export default function ProfileLoading() {
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-pulse">
      <div className="h-6 w-20 bg-slate-200 rounded-lg" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="h-5 w-24 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-9 w-28 bg-slate-200 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
