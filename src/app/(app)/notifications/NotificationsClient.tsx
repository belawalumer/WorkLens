'use client'

import { useState, useMemo } from 'react'

interface RawNotif {
  id: string
  message: string
  type: string
  created_at: string
  read: boolean
}

const TYPE_ICON: Record<string, string> = {
  task_added:    '📋',
  task_completed:'✅',
  task_updated:  '✏️',
  member_joined: '👋',
}

function fmt(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

type FilterType = 'all' | 'today' | 'yesterday' | 'custom'

export default function NotificationsClient({ notifications }: { notifications: RawNotif[] }) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [customDate, setCustomDate] = useState('')

  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications
    if (filter === 'today') return notifications.filter(n => {
      const d = new Date(n.created_at)
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    })
    if (filter === 'yesterday') return notifications.filter(n => {
      const d = new Date(n.created_at)
      return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()
    })
    if (filter === 'custom' && customDate) return notifications.filter(n => n.created_at.startsWith(customDate))
    return notifications
  }, [notifications, filter, customDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Group by date label
  const groups = useMemo(() => {
    const map = new Map<string, RawNotif[]>()
    for (const n of filtered) {
      const label = dateLabel(n.created_at)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(n)
    }
    return Array.from(map.entries())
  }, [filtered])

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'custom', label: 'By date' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500 mt-0.5">{notifications.length} total</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${filter === f.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {filter === 'custom' && (
          <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white shadow-sm" />
        )}
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center shadow-sm">
          <p className="text-slate-600 font-medium">No notifications found</p>
          <p className="text-slate-400 text-sm mt-1">Try a different filter</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                {items.map(n => (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-4">
                    <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{fmt(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
