'use client'

import { useState, useMemo } from 'react'
import { Profile, Task, ROLE_LABELS, Role } from '@/types'

type Period = 'today' | 'week' | 'month' | '3months' | '6months'
type TaskFilter = 'all' | 'done' | 'pending'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today',    label: 'Today' },
  { key: 'week',     label: 'This Week' },
  { key: 'month',    label: 'This Month' },
  { key: '3months',  label: '3 Months' },
  { key: '6months',  label: '6 Months' },
]

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function getRange(period: Period): { start: string; end: string } {
  const today = new Date()
  const end = today.toISOString().split('T')[0]
  if (period === 'today') return { start: end, end }
  if (period === 'week') {
    const d = new Date(today)
    const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
    return { start: d.toISOString().split('T')[0], end }
  }
  if (period === 'month') {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0], end }
  }
  const months = period === '3months' ? 3 : 6
  const d = new Date(today)
  d.setMonth(d.getMonth() - months)
  return { start: d.toISOString().split('T')[0], end }
}

function getFixedRanges() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekStart = new Date(today)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1))
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  return { todayStr, weekStart: weekStart.toISOString().split('T')[0], monthStart }
}

function getMonthlyHistory(tasks: Task[], devId: string) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const start = d.toISOString().split('T')[0]
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const end = last.toISOString().split('T')[0]
    const mt = tasks.filter(t => t.developer_id === devId && t.task_date >= start && t.task_date <= end)
    const hours = mt.reduce((s, t) => s + t.estimated_hours, 0)
    const done = mt.filter(t => t.completed).length
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      hours,
      tasks: mt.length,
      done,
      pct: mt.length ? Math.round((done / mt.length) * 100) : 0,
    }
  })
}

interface Props { profiles: Profile[]; tasks: Task[] }

export default function ReportsClient({ profiles, tasks }: Props) {
  const [period, setPeriod] = useState<Period>('week')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')

  const { start, end } = useMemo(() => getRange(period), [period])
  const fixed = useMemo(() => getFixedRanges(), [])

  const developers = useMemo(() =>
    profiles.filter(p => !search.trim() || p.full_name.toLowerCase().includes(search.toLowerCase())),
    [profiles, search],
  )

  function stats(devId: string, s: string, e: string) {
    const dt = tasks.filter(t => t.developer_id === devId && t.task_date >= s && t.task_date <= e)
    const hours = dt.reduce((acc, t) => acc + t.estimated_hours, 0)
    const done = dt.filter(t => t.completed)
    return {
      hours,
      total: dt.length,
      done: done.length,
      doneHours: done.reduce((acc, t) => acc + t.estimated_hours, 0),
      pct: dt.length ? Math.round((done.length / dt.length) * 100) : 0,
    }
  }

  function expand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setTaskFilter('all')
  }

  return (
    <div className="page-enter max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Developer activity and workload history</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search developer…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-52 transition-colors" />
        </div>
      </div>

      {/* Period selector */}
      <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden text-sm shadow-sm mb-5 w-fit">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${period === p.key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_88px_72px_72px_120px_36px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          <span>Developer</span>
          <span className="text-right">Hours</span>
          <span className="text-right">Tasks</span>
          <span className="text-right">Done</span>
          <span className="text-right">Completion</span>
          <span />
        </div>

        {developers.length === 0 && (
          <p className="text-center py-12 text-slate-400 text-sm">No developers found.</p>
        )}

        {developers.map((dev, i) => {
          const s = stats(dev.id, start, end)
          const isExpanded = expandedId === dev.id
          const history = isExpanded ? getMonthlyHistory(tasks, dev.id) : []
          const todayS = stats(dev.id, fixed.todayStr, fixed.todayStr)
          const weekS = stats(dev.id, fixed.weekStart, fixed.todayStr)
          const monthS = stats(dev.id, fixed.monthStart, fixed.todayStr)

          const periodTasks = isExpanded
            ? tasks
                .filter(t => t.developer_id === dev.id && t.task_date >= start && t.task_date <= end)
                .filter(t => taskFilter === 'all' ? true : taskFilter === 'done' ? t.completed : !t.completed)
            : []

          return (
            <div key={dev.id} className={i < developers.length - 1 || isExpanded ? 'border-b border-slate-100' : ''}>

              {/* Summary row */}
              <div
                onClick={() => expand(dev.id)}
                className="grid grid-cols-[1fr_auto_36px] sm:grid-cols-[1fr_88px_72px_72px_120px_36px] gap-4 items-center px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* Developer */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                    {initials(dev.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{dev.full_name}</p>
                    <p className="text-xs text-slate-400">{ROLE_LABELS[dev.role as Role]}</p>
                  </div>
                </div>

                {/* Mobile: hours only */}
                <div className="sm:hidden text-right">
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(s.hours)}h</p>
                  <p className="text-[11px] text-slate-400">{s.total} tasks</p>
                </div>

                {/* Desktop columns */}
                <p className="hidden sm:block text-sm font-bold text-slate-800 text-right tabular-nums">{fmt(s.hours)}h</p>
                <p className="hidden sm:block text-sm text-slate-600 text-right tabular-nums">{s.total}</p>
                <p className="hidden sm:block text-sm text-slate-600 text-right tabular-nums">{s.done}</p>
                <div className="hidden sm:flex items-center justify-end gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums w-8 text-right">{s.pct}%</span>
                </div>

                {/* Chevron */}
                <div className="flex justify-end">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 space-y-6">

                  {/* Quick stats: always today / this week / this month */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Today', s: todayS },
                      { label: 'This Week', s: weekS },
                      { label: 'This Month', s: monthS },
                    ].map(({ label, s: st }) => (
                      <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                        <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{fmt(st.hours)}<span className="text-sm font-semibold text-slate-400 ml-0.5">h</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">{st.total} tasks · {st.done} done</p>
                      </div>
                    ))}
                  </div>

                  {/* Monthly history */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Monthly History</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {history.map(m => {
                        const maxH = Math.max(...history.map(x => x.hours), 1)
                        return (
                          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] text-slate-400 font-medium truncate">{m.label}</p>
                            <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">{fmt(m.hours)}<span className="text-xs text-slate-400 ml-0.5">h</span></p>
                            <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-brand-400 rounded-full" style={{ width: `${Math.round((m.hours / maxH) * 100)}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5">{m.tasks} tasks · {m.pct}% done</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Task list */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                        Tasks — {PERIODS.find(p => p.key === period)?.label}
                      </p>
                      <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-xs shadow-sm">
                        {(['all', 'done', 'pending'] as TaskFilter[]).map(f => (
                          <button key={f} onClick={e => { e.stopPropagation(); setTaskFilter(f) }}
                            className={`px-2.5 py-1 font-medium transition-colors capitalize ${taskFilter === f ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {periodTasks.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8 bg-white border border-slate-200 rounded-xl">No tasks for this period.</p>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="hidden sm:grid sm:grid-cols-[16px_1fr_140px_80px_60px] gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                          <span/>
                          <span>Task</span>
                          <span>Project</span>
                          <span className="text-right">Date</span>
                          <span className="text-right">Hours</span>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                          {periodTasks.map(task => (
                            <div key={task.id} className="grid grid-cols-[16px_1fr_60px] sm:grid-cols-[16px_1fr_140px_80px_60px] gap-3 items-center px-4 py-2.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${task.completed ? 'bg-green-400' : 'bg-slate-300'}`} />
                              <div className="min-w-0">
                                <p className={`text-xs truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`} title={task.title}>
                                  {task.title}
                                </p>
                                <p className="text-[10px] text-slate-400 sm:hidden">{task.project?.name ?? '—'} · {new Date(task.task_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                              </div>
                              <p className="hidden sm:block text-xs text-slate-400 truncate">{task.project?.name ?? '—'}</p>
                              <p className="hidden sm:block text-xs text-slate-400 text-right">
                                {new Date(task.task_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs font-semibold text-slate-700 text-right tabular-nums">{fmt(task.estimated_hours)}h</p>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                          <span>{periodTasks.length} task{periodTasks.length !== 1 ? 's' : ''}</span>
                          <span className="font-semibold text-slate-700">{fmt(periodTasks.reduce((s, t) => s + t.estimated_hours, 0))}h total</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
