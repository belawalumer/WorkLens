'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Profile, DeveloperRole, Task, DeveloperWithData, WorkloadStatus, getWorkloadStatus, Role, UNAVAILABLE_STATUSES, UserStatus, USER_STATUS_CONFIG } from '@/types'
import DeveloperCard from '@/components/DeveloperCard'

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)
const initials = (name: string) => { const p = name.trim().split(/\s+/); return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() }

function isPKTAfterNoon() {
  return (parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false })) % 24) >= 12
}

interface Props {
  profiles: Profile[]
  roles: DeveloperRole[]
  tasks: Task[]
  currentUserId: string
  currentUserRole: Role
  todayHoliday?: string | null
}

type FilterStatus = 'all' | 'available' | 'full' | 'underloaded' | 'overloaded'

const TODAY = new Date().toISOString().split('T')[0]

function buildDeveloperData(
  profiles: Profile[],
  roles: DeveloperRole[],
  tasks: Task[],
): DeveloperWithData[] {
  return profiles.map(profile => {
    const devRoles = roles.filter(r => r.developer_id === profile.id)
    const todayTasks = tasks.filter(t => t.developer_id === profile.id && t.task_date === TODAY)
    const todayHours = todayTasks.reduce((s, t) => s + t.estimated_hours, 0)
    const completedHours = todayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
    return {
      ...profile,
      roles: devRoles,
      tasks: todayTasks,
      todayHours,
      completedHours,
      remainingHours: todayHours - completedHours,
      freeHours: 8 - todayHours,
      weeklyHours: todayHours,
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
  accent?: 'blue' | 'red' | 'green' | 'amber' | 'purple'
  tooltip?: { name: string; value: string }[]
}) {
  const border = accent === 'blue'   ? 'border-l-blue-400'
    : accent === 'red'    ? 'border-l-red-400'
    : accent === 'green'  ? 'border-l-green-400'
    : accent === 'amber'  ? 'border-l-amber-400'
    : accent === 'purple' ? 'border-l-purple-400'
    : 'border-l-slate-200'

  return (
    <div className={`relative group bg-white border border-slate-200 border-l-4 ${border} rounded-2xl px-5 py-4 shadow-sm`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      {sub && (
        <p className={`text-xs text-slate-500 mt-1 ${tooltip?.length ? 'underline decoration-dotted decoration-slate-300 underline-offset-2 cursor-default' : ''}`}>
          {sub}
        </p>
      )}
      {tooltip && tooltip.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="space-y-1">
            {tooltip.map(t => (
              <div key={t.name} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600">{t.name}</span>
                <span className="font-semibold text-slate-800 shrink-0">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const STATUS_DISTRIBUTION: Record<WorkloadStatus, { label: string; color: string }> = {
  overloaded:  { label: 'Overloaded',  color: '#dc2626' },
  full:        { label: 'Occupied',   color: '#0078b7' },
  underloaded: { label: 'Underloaded', color: '#ca8a04' },
  available:   { label: 'Available',   color: '#25D366' },
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Dashboard({
  profiles: initProfiles, roles: initRoles, tasks: initTasks, currentUserId, currentUserRole, todayHoliday,
}: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const supabase = createClient()

  const { data: todayLeaves = [] } = useSWR<{ developer_id: string; leave_type: string }[]>(
    'today-leaves',
    async () => (await supabase.from('leave_records').select('developer_id, leave_type').eq('leave_date', TODAY)).data ?? [],
    { revalidateOnFocus: true },
  )

  const { data: tasks = initTasks } = useSWR(
    'dashboard-tasks',
    async () => (await supabase.from('tasks').select('*, project:projects(id, name)').eq('task_date', TODAY)).data ?? [],
    { fallbackData: initTasks, revalidateOnFocus: true },
  )
  const { data: profiles = initProfiles } = useSWR(
    'profiles',
    async () => (await supabase.from('profiles').select('*').order('full_name')).data ?? [],
    { fallbackData: initProfiles, revalidateOnFocus: true },
  )
  const { data: roles = initRoles } = useSWR(
    'developer-roles',
    async () => (await supabase.from('developer_roles').select('*, project:projects(id, name)')).data ?? [],
    { fallbackData: initRoles, revalidateOnFocus: true },
  )

  useEffect(() => {
    const ch = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        globalMutate('profiles')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        globalMutate('dashboard-tasks')
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const developers = buildDeveloperData(profiles, roles, tasks)

  const activeDevs = developers.filter(d => !UNAVAILABLE_STATUSES.includes((d.user_status ?? 'active') as UserStatus))

  const filtered = filter === 'all' ? developers
    : filter === 'available' ? activeDevs.filter(d => d.status === 'available')
    : filter === 'full' ? activeDevs.filter(d => d.status === 'full')
    : filter === 'underloaded' ? activeDevs.filter(d => d.status === 'underloaded')
    : activeDevs.filter(d => d.status === 'overloaded')

  const overloadedCount = activeDevs.filter(d => d.status === 'overloaded').length
  const availableDevs = activeDevs.filter(d => d.role === 'developer' && d.freeHours > 0)
  const availableCount = availableDevs.length
  const totalFreeCapacity = availableDevs.reduce((s, d) => s + d.freeHours, 0)
  const totalPlanned = activeDevs.reduce((s, d) => s + d.todayHours, 0)
  const avgLoad = activeDevs.length > 0 ? totalPlanned / activeDevs.length : 0

  const onLeaveToday = developers.filter(d => {
    if (!UNAVAILABLE_STATUSES.includes((d.user_status ?? 'active') as UserStatus)) return false
    if (currentUserRole === 'developer') return d.role === 'developer'
    if (currentUserRole === 'hr_admin') return d.role !== 'super_admin'
    return true
  })

  // Inactive today — derived from SWR data, auto-updates when tasks/profiles change
  const inactiveToday = developers.filter(d => {
    if (d.tasks.length > 0) return false
    if (UNAVAILABLE_STATUSES.includes((d.user_status ?? 'active') as UserStatus)) return false
    if (currentUserRole === 'developer') return d.role === 'developer'
    if (currentUserRole === 'hr_admin') return d.role !== 'super_admin'
    return true
  })

  function buildWhatsAppUrl(dev: DeveloperWithData) {
    const msg = encodeURIComponent(
      `Hi ${dev.full_name.split(' ')[0]}! Hope you're having a great day. Just a quick reminder to log your tasks for today on WorkLens: https://work-lens-kappa.vercel.app/my-tasks - Your updates help the whole team stay in sync. Thanks!`
    )
    const phone = ((dev as Profile & { whatsapp?: string | null }).whatsapp ?? '').replace(/\D/g, '')
    return `https://wa.me/${phone}?text=${msg}`
  }

  // Weekend & greeting helpers
  const now = new Date()
  const dayOfWeek = now.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const weekendMessages = [
    "Hope you're enjoying the weekend with family and loved ones! 🎉",
    "Take it easy — you've earned the rest! 🌴",
    "Weekend mode on! Recharge for the week ahead ⚡",
    "Hope you're having a wonderful time with your loved ones! 🏡",
  ]
  const weekendMsg = weekendMessages[now.getDate() % weekendMessages.length]

  const h = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false })) % 24
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'
  const firstName = profiles.find(p => p.id === currentUserId)?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm text-slate-500">{greeting}, {firstName} 👋</p>
        {isWeekend && (
          <p className="text-xs text-brand-600 font-medium mt-0.5">{weekendMsg}</p>
        )}
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">Team Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Holiday banner ─────────────────────────────────────────────── */}
      {todayHoliday && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <span className="text-xl shrink-0">🎉</span>
          <div>
            <p className="text-sm font-semibold text-brand-800">Public Holiday: {todayHoliday}</p>
          </div>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Team Members" value={developers.length} accent="purple" />
        <StatCard
          label="Avg Load Today"
          value={`${fmt(avgLoad)}h`}
          sub={`${fmt(totalPlanned)}h total planned`}
          accent="amber"
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
          accent="red"
        />
      </div>

      {/* ── Status summary strip ────────────────────────────────────────── */}
      {developers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Status Distribution</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(STATUS_DISTRIBUTION) as [WorkloadStatus, { label: string; color: string }][]).map(([key, s]) => {
              const devsInStatus = developers.filter(d => d.status === key)
              const count = devsInStatus.length
              const pct = developers.length > 0 ? (count / developers.length) * 100 : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">{s.label}</span>
                      <div className="relative group/tip">
                        <span className="text-xs font-bold text-slate-800 cursor-default">{count}</span>
                        {count > 0 && (
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover/tip:block z-20 bg-slate-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl w-max max-w-52 space-y-0.5 pointer-events-none">
                            {devsInStatus.map(d => <div key={d.id} className="whitespace-nowrap">{d.full_name}</div>)}
                            <div className="absolute right-2 top-full border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Hasn't added today's tasks ──────────────────────────────── */}
      {!todayHoliday && isPKTAfterNoon() && inactiveToday.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-3">
            ⚠️ No Tasks Today · {inactiveToday.length}
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden divide-y divide-amber-100">
            {inactiveToday.map(dev => {
              const wa = (dev as Profile & { whatsapp?: string | null }).whatsapp
              return (
                <div key={dev.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <span className="text-amber-700 font-bold text-xs">{initials(dev.full_name)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">{dev.full_name}</p>
                  {wa ? (
                    <a href={buildWhatsAppUrl(dev)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-lg hover:bg-[#20ba58] transition-colors shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Send Reminder
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 shrink-0 italic">No WhatsApp</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── On Leave Today ───────────────────────────────────────────── */}
      {onLeaveToday.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            🏠 On Leave Today · {onLeaveToday.length}
          </h2>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            {onLeaveToday.map(dev => {
              const leaveRecord = todayLeaves.find(l => l.developer_id === dev.id)
              const dayLabel = leaveRecord?.leave_type === 'full' ? 'Full day' : leaveRecord ? 'Half day' : null
              return (
                <div key={dev.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-slate-500 font-bold text-xs">{initials(dev.full_name)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">{dev.full_name}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dayLabel && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        {dayLabel}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      dev.user_status === 'vacation'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Member cards ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {filter === 'all' ? 'All Members' : filter === 'available' ? 'Available' : filter === 'full' ? 'Occupied' : filter === 'underloaded' ? 'Underloaded' : 'Overloaded'}
            {' '}· {filtered.length}
          </h2>
          <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden text-sm shadow-sm">
            {([
              { key: 'all',        label: 'All' },
              { key: 'available',  label: 'Available' },
              { key: 'full',       label: 'Occupied' },
              { key: 'underloaded',label: 'Underloaded' },
              { key: 'overloaded', label: 'Overloaded' },
            ] as { key: FilterStatus; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)}
                className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${filter === t.key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-96">
          {[...filtered].sort((a, b) => {
            if (a.id === currentUserId) return -1
            if (b.id === currentUserId) return 1
            return 0
          }).map(dev => (
            <DeveloperCard key={dev.id} dev={dev} isMe={dev.id === currentUserId} viewerRole={currentUserRole} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-slate-500 py-12">No members match this filter.</p>
          )}
        </div>
      </div>

    </div>
  )
}
