'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, PieChart, Pie,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Profile, DeveloperRole, Task, DeveloperWithData, WorkloadStatus, getWorkloadStatus, Role, UNAVAILABLE_STATUSES, UserStatus } from '@/types'
import DeveloperCard from '@/components/DeveloperCard'

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

interface Props {
  profiles: Profile[]
  roles: DeveloperRole[]
  tasks: Task[]
  currentUserId: string
  currentUserRole: Role
}

type ViewMode = 'today' | 'week'
type FilterStatus = 'all' | 'available' | 'overloaded'

const TODAY = new Date().toISOString().split('T')[0]

// Status → solid color (completed portion)
const STATUS_SOLID: Record<WorkloadStatus, string> = {
  overloaded: '#dc2626',
  full:        '#16a34a',
  underloaded: '#ca8a04',
  available:   '#2563eb',
}

// Status → light color (remaining/unfinished portion)
const STATUS_LIGHT: Record<WorkloadStatus, string> = {
  overloaded: '#fca5a5',
  full:        '#86efac',
  underloaded: '#fde047',
  available:   '#93c5fd',
}

function buildDeveloperData(
  profiles: Profile[],
  roles: DeveloperRole[],
  tasks: Task[],
  viewMode: ViewMode
): DeveloperWithData[] {
  return profiles.map(profile => {
    const devRoles = roles.filter(r => r.developer_id === profile.id)
    const todayTasks = tasks.filter(t => t.developer_id === profile.id && t.task_date === TODAY)
    const allTasks = tasks.filter(t => t.developer_id === profile.id)

    const todayHours = todayTasks.reduce((s, t) => s + t.estimated_hours, 0)
    const completedHours = todayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
    const weeklyHours = allTasks.reduce((s, t) => s + t.estimated_hours, 0)

    return {
      ...profile,
      roles: devRoles,
      tasks: viewMode === 'today' ? todayTasks : allTasks,
      todayHours,
      completedHours,
      remainingHours: todayHours - completedHours,
      freeHours: 8 - todayHours,
      weeklyHours,
      status: getWorkloadStatus(todayHours),
    }
  })
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent, tooltip,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'blue' | 'red' | 'green' | 'amber'
  tooltip?: { name: string; value: string }[]
}) {
  const border = accent === 'blue' ? 'border-l-blue-400'
    : accent === 'red'   ? 'border-l-red-400'
    : accent === 'green' ? 'border-l-green-400'
    : accent === 'amber' ? 'border-l-amber-400'
    : 'border-l-slate-200'

  return (
    <div className={`relative group bg-white border border-slate-200 border-l-4 ${border} rounded-2xl px-5 py-4 shadow-sm`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      {sub && (
        <p className={`text-xs text-slate-400 mt-1 ${tooltip?.length ? 'underline decoration-dotted decoration-slate-300 underline-offset-2 cursor-default' : ''}`}>
          {sub}
        </p>
      )}
      {tooltip && tooltip.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="space-y-1">
            {tooltip.map(t => (
              <div key={t.name} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 truncate">{t.name}</span>
                <span className="font-semibold text-slate-800 shrink-0">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface BarEntry {
  name: string
  fullName: string
  completed: number
  remaining: number
  planned: number
  status: WorkloadStatus
}

function WorkloadTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: BarEntry }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl text-xs min-w-[150px]">
      <p className="font-semibold text-slate-800 text-sm mb-2">{d.fullName}</p>
      <div className="space-y-1 text-slate-600">
        <div className="flex justify-between gap-4">
          <span>Planned</span>
          <span className="font-semibold text-slate-800">{d.planned}h</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Completed</span>
          <span className="font-semibold text-green-700">{d.completed}h</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Remaining</span>
          <span className="font-semibold text-slate-800">{d.remaining}h</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 mt-1">
          <span>Free capacity</span>
          <span className="font-semibold text-blue-600">{fmt(Math.max(0, 8 - d.planned))}h</span>
        </div>
      </div>
    </div>
  )
}

const DONUT_STATUS = [
  { key: 'overloaded',  label: 'Overloaded',  color: '#dc2626' },
  { key: 'full',        label: 'Full Load',   color: '#16a34a' },
  { key: 'underloaded', label: 'Underloaded', color: '#ca8a04' },
  { key: 'available',   label: 'Available',   color: '#2563eb' },
] as const

// ─── Main component ────────────────────────────────────────────────────────────

export default function Dashboard({
  profiles: initProfiles, roles: initRoles, tasks: initTasks, currentUserId, currentUserRole,
}: Props) {
  const [profiles, setProfiles] = useState(initProfiles)
  const [roles, setRoles] = useState(initRoles)
  const [tasks, setTasks] = useState(initTasks)
  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [toast, setToast] = useState('')
  const supabase = createClient()

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('workload-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        setTasks(prev => {
          if (payload.eventType === 'INSERT') { showToast('📋 New task added'); return [...prev, payload.new as Task] }
          if (payload.eventType === 'UPDATE') return prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t)
          if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== (payload.old as Task).id)
          return prev
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, payload => {
        setProfiles(prev => [...prev, payload.new as Profile].sort((a, b) => a.full_name.localeCompare(b.full_name)))
        showToast('👋 New team member joined')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_roles' }, async () => {
        const { data } = await supabase.from('developer_roles').select('*, project:projects(id, name)')
        if (data) setRoles(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const developers = buildDeveloperData(profiles, roles, tasks, viewMode)

  // Devs actively working (exclude on_leave / vacation from hour calculations)
  const activeDevs = developers.filter(d => !UNAVAILABLE_STATUSES.includes((d.user_status ?? 'active') as UserStatus))

  // Filtered list for cards (still show unavailable devs in "all" view)
  const filtered = filter === 'all' ? developers
    : filter === 'available' ? activeDevs.filter(d => d.status === 'available' || d.status === 'underloaded')
    : activeDevs.filter(d => d.status === 'overloaded')

  // Stat card values — based on active devs only
  const overloadedCount = activeDevs.filter(d => d.status === 'overloaded').length
  const availableDevs = activeDevs.filter(d => d.role === 'developer' && d.freeHours > 0)
  const availableCount = availableDevs.length
  const totalFreeCapacity = availableDevs.reduce((s, d) => s + d.freeHours, 0)
  const totalPlanned = activeDevs.reduce((s, d) => s + d.todayHours, 0)
  const avgLoad = activeDevs.length > 0 ? totalPlanned / activeDevs.length : 0

  // Bar chart data — sorted by planned hours desc
  const barData: BarEntry[] = [...developers]
    .sort((a, b) => b.todayHours - a.todayHours)
    .map(d => ({
      name: d.full_name.split(' ')[0],
      fullName: d.full_name,
      completed: d.completedHours,
      remaining: Math.max(0, d.todayHours - d.completedHours),
      planned: d.todayHours,
      status: d.status,
    }))

  const barMax = Math.max(10, ...barData.map(d => d.planned + 0.5))
  const chartHeight = Math.max(developers.length * 56, 200)

  // Donut data
  const donutData = DONUT_STATUS
    .map(s => ({ ...s, value: developers.filter(d => d.status === s.key).length }))
    .filter(s => s.value > 0)

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm shadow-sm">
            {(['today', 'week'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 font-medium transition-colors ${viewMode === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                {v === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value as FilterStatus)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
            <option value="all">All members</option>
            <option value="available">Has capacity</option>
            <option value="overloaded">Overloaded</option>
          </select>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Team Members" value={developers.length} />
        <StatCard
          label="Avg Load Today"
          value={`${fmt(avgLoad)}h`}
          sub={`${fmt(totalPlanned)}h total planned`}
          accent={avgLoad > 8 ? 'red' : avgLoad >= 6 ? 'green' : 'amber'}
          tooltip={developers.map(d => ({ name: d.full_name, value: `${fmt(d.todayHours)}h planned` }))}
        />
        <StatCard
          label="Free Capacity"
          value={`${fmt(totalFreeCapacity)}h`}
          sub={`across ${availableCount} developer${availableCount !== 1 ? 's' : ''}`}
          accent="blue"
          tooltip={availableDevs.map(d => ({ name: d.full_name, value: `${fmt(Math.max(0, d.freeHours))}h free` }))}
        />
        <StatCard
          label="Overloaded"
          value={overloadedCount}
          sub={overloadedCount === 0 ? 'All within capacity ✓' : 'Need attention'}
          accent={overloadedCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      {developers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Workload bar chart */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-800">Today&apos;s Workload</h2>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-700 inline-block" />
                  Completed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />
                  Remaining
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">Dashed line = 8h full capacity</p>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }} barCategoryGap="28%">
                <XAxis
                  type="number"
                  domain={[0, barMax]}
                  tickFormatter={v => `${v}h`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
                  width={64}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={(props) => <WorkloadTooltip active={props.active} payload={props.payload as unknown as Array<{ payload: BarEntry }>} />} cursor={{ fill: '#f8fafc' }} />
                <ReferenceLine x={8} stroke="#cbd5e1" strokeDasharray="5 3" />
                {/* Completed portion */}
                <Bar dataKey="completed" stackId="a" barSize={22}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_SOLID[entry.status]} />
                  ))}
                </Bar>
                {/* Remaining portion */}
                <Bar dataKey="remaining" stackId="a" barSize={22} radius={[0, 5, 5, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_LIGHT[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status donut */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Status Distribution</h2>
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              {/* Donut */}
              <div className="relative" style={{ width: 180, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="#fff"
                      paddingAngle={donutData.length > 1 ? 2 : 0}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const item = payload[0]
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xl text-xs">
                            <p className="font-semibold text-slate-700">{item.name}</p>
                            <p className="text-slate-500">{String(item.value)} member{Number(item.value) !== 1 ? 's' : ''}</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-900 leading-none">{developers.length}</span>
                  <span className="text-xs text-slate-400 mt-1">members</span>
                </div>
              </div>

              {/* Legend */}
              <div className="w-full space-y-2">
                {DONUT_STATUS.map(s => {
                  const count = developers.filter(d => d.status === s.key).length
                  const pct = developers.length > 0 ? Math.round((count / developers.length) * 100) : 0
                  return (
                    <div key={s.key} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-slate-600 flex-1">{s.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 w-4 text-right">{count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Member cards ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wide">
          {filter === 'all' ? 'All Members' : filter === 'available' ? 'Available Members' : 'Overloaded Members'}
          {' '}· {filtered.length}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...filtered].sort((a, b) => {
            if (a.id === currentUserId) return -1
            if (b.id === currentUserId) return 1
            return 0
          }).map(dev => (
            <DeveloperCard key={dev.id} dev={dev} isMe={dev.id === currentUserId} viewerRole={currentUserRole} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-slate-400 py-12">No members match this filter.</p>
          )}
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
