'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, DeveloperRole, Task, DeveloperWithData, getWorkloadStatus } from '@/types'
import DeveloperCard from '@/components/DeveloperCard'

interface Props {
  profiles: Profile[]
  roles: DeveloperRole[]
  tasks: Task[]
  currentUserId: string
}

type ViewMode = 'today' | 'week'
type FilterStatus = 'all' | 'available' | 'overloaded'

const TODAY = new Date().toISOString().split('T')[0]

function buildDeveloperData(
  profiles: Profile[],
  roles: DeveloperRole[],
  tasks: Task[],
  viewMode: ViewMode
): DeveloperWithData[] {
  return profiles.map(profile => {
    const devRoles = roles.filter(r => r.developer_id === profile.id)
    const devTasks = tasks.filter(t => {
      if (t.developer_id !== profile.id) return false
      return viewMode === 'today' ? t.task_date === TODAY : true
    })

    const todayTasks = tasks.filter(t => t.developer_id === profile.id && t.task_date === TODAY)
    const todayHours = todayTasks.reduce((sum, t) => sum + t.estimated_hours, 0)
    const completedHours = todayTasks.filter(t => t.completed).reduce((sum, t) => sum + t.estimated_hours, 0)
    const weeklyHours = tasks.filter(t => t.developer_id === profile.id).reduce((sum, t) => sum + t.estimated_hours, 0)

    return {
      ...profile,
      roles: devRoles,
      tasks: viewMode === 'today' ? todayTasks : devTasks,
      todayHours,
      completedHours,
      remainingHours: todayHours - completedHours,
      freeHours: 8 - todayHours,
      weeklyHours,
      status: getWorkloadStatus(todayHours),
    }
  })
}

export default function Dashboard({ profiles: initProfiles, roles: initRoles, tasks: initTasks, currentUserId }: Props) {
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
          if (payload.eventType === 'INSERT') {
            showToast('📋 New task added')
            return [...prev, payload.new as Task]
          }
          if (payload.eventType === 'UPDATE') {
            return prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t)
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter(t => t.id !== (payload.old as Task).id)
          }
          return prev
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, payload => {
        setProfiles(prev => [...prev, payload.new as Profile].sort((a, b) => a.full_name.localeCompare(b.full_name)))
        showToast('👋 New developer joined')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_roles' }, async () => {
        const { data } = await supabase.from('developer_roles').select('*, project:projects(id, name)')
        if (data) setRoles(data)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const developers = buildDeveloperData(profiles, roles, tasks, viewMode)
  const filtered = filter === 'all' ? developers
    : filter === 'available' ? developers.filter(d => d.status === 'available' || d.status === 'underloaded')
    : developers.filter(d => d.status === 'overloaded')

  const availableCount = developers.filter(d => d.freeHours > 2).length
  const overloadedCount = developers.filter(d => d.status === 'overloaded').length

  return (
    <div>
      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {developers.length} developers · {availableCount} with free capacity · {overloadedCount} overloaded
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
            {(['today', 'week'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 font-medium transition-colors capitalize ${viewMode === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {v === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>
          {/* Filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as FilterStatus)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="all">All developers</option>
            <option value="available">Has capacity</option>
            <option value="overloaded">Overloaded</option>
          </select>
        </div>
      </div>

      {/* Summary strip for available capacity */}
      {availableCount > 0 && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
          <span className="text-base">🔵</span>
          <span>
            <strong>{availableCount} developer{availableCount > 1 ? 's' : ''}</strong> with meaningful free capacity today —{' '}
            {developers
              .filter(d => d.freeHours > 2)
              .map(d => `${d.full_name} (${Math.max(0, d.freeHours).toFixed(1)}h free)`)
              .join(', ')}
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(dev => (
          <DeveloperCard key={dev.id} dev={dev} isMe={dev.id === currentUserId} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-slate-400 py-12">No developers match this filter.</p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
