'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, Project } from '@/types'

const TODAY = new Date().toISOString().split('T')[0]

function getWeekDates() {
  const dates: string[] = []
  const d = new Date()
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  for (let i = 0; i < 5; i++) {
    const next = new Date(mon)
    next.setDate(mon.getDate() + i)
    dates.push(next.toISOString().split('T')[0])
  }
  return dates
}

const WEEKDAYS = getWeekDates()

interface Props {
  initialTasks: Task[]
  projects: Project[]
  userId: string
}

export default function MyTasks({ initialTasks, projects, userId }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [view, setView] = useState<'today' | 'week'>('today')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', estimated_hours: '1', project_id: '', task_date: TODAY })
  const [saving, setSaving] = useState(false)
  const [addProject, setAddProject] = useState('')
  const [addingProject, setAddingProject] = useState(false)
  const [projectList, setProjectList] = useState(projects)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('my-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `developer_id=eq.${userId}` }, payload => {
        setTasks(prev => {
          if (payload.eventType === 'INSERT') return [payload.new as Task, ...prev]
          if (payload.eventType === 'UPDATE') return prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t)
          if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== (payload.old as Task).id)
          return prev
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('tasks').insert({
      developer_id: userId,
      title: form.title.trim(),
      estimated_hours: parseFloat(form.estimated_hours) || 1,
      project_id: form.project_id || null,
      task_date: form.task_date,
    })
    setForm({ title: '', estimated_hours: '1', project_id: '', task_date: TODAY })
    setAdding(false)
    setSaving(false)
  }

  async function toggleDone(task: Task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!addProject.trim()) return
    const { data } = await supabase.from('projects').insert({ name: addProject.trim() }).select().single()
    if (data) {
      setProjectList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, project_id: data.id }))
    }
    setAddProject('')
    setAddingProject(false)
  }

  const visibleDates = view === 'today' ? [TODAY] : WEEKDAYS

  const totalToday = tasks.filter(t => t.task_date === TODAY).reduce((s, t) => s + t.estimated_hours, 0)
  const doneToday = tasks.filter(t => t.task_date === TODAY && t.completed).reduce((s, t) => s + t.estimated_hours, 0)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Today: {totalToday.toFixed(1)}h planned · {doneToday.toFixed(1)}h done · {Math.max(0, 8 - totalToday).toFixed(1)}h free
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
            {(['today', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 font-medium transition-colors ${view === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                {v === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            + Add task
          </button>
        </div>
      </div>

      {/* Add task form */}
      {adding && (
        <form onSubmit={addTask} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex gap-2 flex-wrap">
            <input
              type="number"
              min="0.5" max="24" step="0.5"
              value={form.estimated_hours}
              onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))}
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Hours"
            />
            <input
              type="date"
              value={form.task_date}
              onChange={e => setForm(f => ({ ...f, task_date: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="flex gap-1 flex-1 min-w-[160px]">
              {addingProject ? (
                <form onSubmit={createProject} className="flex gap-1 flex-1">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Project name"
                    value={addProject}
                    onChange={e => setAddProject(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button type="submit" className="px-2 py-2 bg-slate-900 text-white rounded-lg text-xs">✓</button>
                  <button type="button" onClick={() => setAddingProject(false)} className="px-2 py-2 border border-slate-300 rounded-lg text-xs">✕</button>
                </form>
              ) : (
                <>
                  <select
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">No project</option>
                    {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setAddingProject(true)} title="New project"
                    className="px-2 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">+</button>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Add task'}
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tasks grouped by date */}
      {visibleDates.map(date => {
        const dayTasks = tasks.filter(t => t.task_date === date)
        const dayLabel = date === TODAY ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        const dayHours = dayTasks.reduce((s, t) => s + t.estimated_hours, 0)

        return (
          <div key={date} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-slate-600">{dayLabel}</h2>
              {dayHours > 0 && <span className="text-xs text-slate-400">{dayHours.toFixed(1)}h</span>}
            </div>
            {dayTasks.length === 0 ? (
              <p className="text-sm text-slate-400 italic px-1">No tasks planned</p>
            ) : (
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <div key={task.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 group">
                    <button
                      onClick={() => toggleDone(task)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-slate-500'}`}
                    >
                      {task.completed && <span className="text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.title}
                      </p>
                      {task.project && (
                        <p className="text-xs text-slate-400">{task.project.name}</p>
                      )}
                    </div>
                    <span className="text-sm text-slate-500 shrink-0">{task.estimated_hours}h</span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
