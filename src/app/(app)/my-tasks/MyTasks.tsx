'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types'
import { toast } from '@/lib/toast'

const TODAY = new Date().toISOString().split('T')[0]
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

function colLabel(date: string) {
  if (date === TODAY) return 'Today'
  if (date === YESTERDAY) return 'Yesterday'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface Props { initialTasks: Task[]; userId: string }
interface EstimateEdit { taskId: string; originalHours: number; hours: string; reason: string; reasonError: boolean }

export default function MyTasks({ initialTasks, userId }: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', estimated_hours: '1', task_date: TODAY, project_id: '' })
  const [saving, setSaving] = useState(false)
  const [estimateEdit, setEstimateEdit] = useState<EstimateEdit | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ taskId: string; title: string } | null>(null)
  const supabase = createClient()

  const { data: projects = [] } = useSWR<{ id: string; name: string }[]>(
    'projects',
    async () => (await supabase.from('projects').select('id, name').order('name')).data ?? [],
  )

  const { data: tasks = initialTasks, mutate: mutateTasks } = useSWR(
    ['my-tasks', userId],
    async () => (await supabase.from('tasks').select('*, project:projects(id, name)')
      .eq('developer_id', userId)
      .order('task_date', { ascending: false })
      .order('created_at', { ascending: false })).data ?? [],
    { fallbackData: initialTasks, revalidateOnFocus: true },
  )

  useEffect(() => {
    const channel = supabase
      .channel('my-tasks')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `developer_id=eq.${userId}` }, payload => {
        mutateTasks(prev => (prev ?? []).map(t => t.id === (payload.new as Task).id ? payload.new as Task : t), false)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks', filter: `developer_id=eq.${userId}` }, payload => {
        mutateTasks(prev => (prev ?? []).filter(t => t.id !== (payload.old as Task).id), false)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const projectId = form.project_id || null
    const tempTask: Task = {
      id: crypto.randomUUID(),
      developer_id: userId,
      project_id: projectId,
      title: form.title.trim(),
      estimated_hours: parseFloat(form.estimated_hours) || 1,
      completed: false,
      task_date: form.task_date,
      estimate_change_reason: null,
    }
    mutateTasks(prev => [tempTask, ...(prev ?? [])], false)
    setForm({ title: '', estimated_hours: '1', task_date: TODAY, project_id: '' })
    setAdding(false)
    setSaving(false)
    await supabase.from('tasks').insert({
      developer_id: userId,
      title: tempTask.title,
      estimated_hours: tempTask.estimated_hours,
      task_date: tempTask.task_date,
      project_id: projectId,
    })
    mutateTasks()
    toast.success('Task added')
  }

  async function toggleDone(task: Task) {
    mutateTasks(prev => (prev ?? []).map(t => t.id === task.id ? { ...t, completed: !t.completed } : t), false)
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    mutateTasks()
  }

  async function deleteTask(id: string) {
    mutateTasks(prev => (prev ?? []).filter(t => t.id !== id), false)
    await supabase.from('tasks').delete().eq('id', id)
    mutateTasks()
    toast.success('Task deleted')
  }

  async function saveTitleEdit(taskId: string, newTitle: string) {
    const trimmed = newTitle.trim()
    if (!trimmed) { setEditingTitle(null); return }
    mutateTasks(prev => (prev ?? []).map(t => t.id === taskId ? { ...t, title: trimmed } : t), false)
    setEditingTitle(null)
    await supabase.from('tasks').update({ title: trimmed }).eq('id', taskId)
    mutateTasks()
    toast.success('Task updated')
  }

  function openEstimateEdit(task: Task) {
    setEstimateEdit({ taskId: task.id, originalHours: task.estimated_hours, hours: String(task.estimated_hours), reason: '', reasonError: false })
  }

  async function saveEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!estimateEdit) return
    const newHours = parseFloat(estimateEdit.hours)
    if (isNaN(newHours) || newHours <= 0) return
    if (newHours !== estimateEdit.originalHours && !estimateEdit.reason.trim()) {
      setEstimateEdit(prev => prev ? { ...prev, reasonError: true } : null)
      return
    }
    const update = {
      estimated_hours: newHours,
      ...(newHours !== estimateEdit.originalHours ? { estimate_change_reason: estimateEdit.reason.trim() } : {}),
    }
    mutateTasks(prev => (prev ?? []).map(t => t.id === estimateEdit!.taskId ? { ...t, ...update } : t), false)
    await supabase.from('tasks').update(update).eq('id', estimateEdit.taskId)
    mutateTasks()
    setEstimateEdit(null)
    toast.success('Estimate updated')
  }

  const todayTasks = tasks.filter(t => t.task_date === TODAY)
  const totalToday = todayTasks.reduce((s, t) => s + t.estimated_hours, 0)
  const doneToday = todayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
  const freeToday = Math.max(0, 8 - totalToday)

  const groupedDates = useMemo(() => {
    const dateSet = new Set(tasks.map(t => t.task_date))
    dateSet.add(TODAY)
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a))
  }, [tasks])

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors bg-slate-50'

  return (
    <div className="page-enter flex flex-col h-full">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
              📅 {fmt(totalToday)}h planned
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              ✅ {fmt(doneToday)}h done
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${freeToday > 2 ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
              🕐 {fmt(freeToday)}h free
            </span>
          </div>
        </div>
        <button onClick={() => setAdding(a => !a)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200">
          + Add task
        </button>
      </div>

      {/* ── Add task form ─────────────────────────────────────────── */}
      {adding && (
        <form onSubmit={addTask} className="bg-white border border-brand-200 rounded-2xl p-4 mb-5 space-y-3 shadow-sm">
          <input autoFocus type="text" placeholder="What needs to be done?"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className={inputCls} />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 shrink-0">⏱</span>
              <input type="number" min="0.05" max="24" step="0.05" value={form.estimated_hours}
                onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))}
                className="w-14 text-sm focus:outline-none bg-transparent" />
              <span className="text-xs text-slate-500">h</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 shrink-0">📅</span>
              <input type="date" value={form.task_date}
                onChange={e => setForm(f => ({ ...f, task_date: e.target.value }))}
                className="text-sm focus:outline-none bg-transparent" />
            </div>
            {projects.length > 0 && (
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-600">
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add task'}
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="px-4 py-2 border border-slate-200 text-sm rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Board ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 flex-1 items-start">
        {groupedDates.map(date => {
          const dayTasks = tasks.filter(t => t.task_date === date)
          const dayHours = dayTasks.reduce((s, t) => s + t.estimated_hours, 0)
          const doneHours = dayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
          const isToday = date === TODAY

          return (
            <div key={date} className="flex-none w-72 flex flex-col">

              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-2xl border border-b-0 ${isToday ? 'bg-brand-600 border-brand-600' : 'bg-slate-100 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-700'}`}>
                    {colLabel(date)}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {dayTasks.length}
                  </span>
                </div>
                {dayHours > 0 && (
                  <span className={`text-xs font-semibold ${isToday ? 'text-white/80' : 'text-slate-500'}`}>
                    {fmt(doneHours)}/{fmt(dayHours)}h
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {dayHours > 0 && (
                <div className={`h-1 ${isToday ? 'bg-brand-400' : 'bg-slate-200'}`}>
                  <div
                    className={`h-full transition-all ${isToday ? 'bg-white/60' : 'bg-brand-400'}`}
                    style={{ width: `${Math.min(100, (doneHours / dayHours) * 100)}%` }}
                  />
                </div>
              )}

              {/* Task cards */}
              <div className={`flex flex-col gap-2 p-2 rounded-b-2xl border border-t-0 min-h-32 ${isToday ? 'bg-brand-50/40 border-brand-200' : 'bg-slate-50 border-slate-200'}`}>
                {dayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-slate-400 text-xs">No tasks yet</p>
                    <button onClick={() => { setForm(f => ({ ...f, task_date: date })); setAdding(true) }}
                      className="mt-1.5 text-brand-600 text-xs font-semibold hover:text-brand-800">
                      + Add one
                    </button>
                  </div>
                ) : (
                  dayTasks.map(task => (
                    <div key={task.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-start gap-2.5 px-3 py-2.5">

                        {/* Checkbox */}
                        <button onClick={() => toggleDone(task)}
                          className={`w-4.5 h-4.5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-brand-400'
                          }`}>
                          {task.completed && <span className="text-[9px] font-bold">✓</span>}
                        </button>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          {editingTitle?.taskId === task.id ? (
                            <input autoFocus type="text"
                              value={editingTitle!.title}
                              onChange={e => setEditingTitle(p => p ? { ...p, title: e.target.value } : null)}
                              onBlur={() => saveTitleEdit(task.id, editingTitle!.title)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); saveTitleEdit(task.id, editingTitle!.title) }
                                if (e.key === 'Escape') setEditingTitle(null)
                              }}
                              className="w-full text-xs font-medium text-slate-800 bg-transparent border-b border-brand-400 focus:outline-none pb-0.5"
                            />
                          ) : (
                            <p onClick={() => !task.completed && setEditingTitle({ taskId: task.id, title: task.title })}
                              className={`text-xs font-medium leading-snug ${task.completed ? 'line-through text-slate-400 cursor-default' : 'text-slate-800 cursor-text hover:text-brand-700'}`}>
                              {task.title}
                            </p>
                          )}
                          {task.project?.name && (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-600 font-medium mt-0.5">
                              {task.project.name}
                            </span>
                          )}
                          {task.estimate_change_reason && (
                            <span className="text-[10px] text-amber-600 mt-0.5 block">✏️ {task.estimate_change_reason}</span>
                          )}
                        </div>
                      </div>

                      {/* Footer: hours + delete */}
                      <div className="flex items-center justify-between px-3 pb-2 gap-2">
                        <button
                          onClick={() => estimateEdit?.taskId === task.id ? setEstimateEdit(null) : openEstimateEdit(task)}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                            estimateEdit?.taskId === task.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-700'
                          }`}>
                          {fmt(task.estimated_hours)}h
                        </button>
                        <button onClick={() => deleteTask(task.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>

                      {/* Estimate edit panel */}
                      {estimateEdit?.taskId === task.id && (
                        <form onSubmit={saveEstimate} className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-semibold text-slate-600 shrink-0">Hours</label>
                            <input autoFocus type="number" min="0.05" max="24" step="0.05"
                              value={estimateEdit!.hours}
                              onChange={e => setEstimateEdit(p => p ? { ...p, hours: e.target.value, reasonError: false } : null)}
                              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                          </div>
                          {parseFloat(estimateEdit!.hours) !== estimateEdit!.originalHours && (
                            <div>
                              <textarea rows={2} placeholder="Reason for change *"
                                value={estimateEdit!.reason}
                                onChange={e => setEstimateEdit(p => p ? { ...p, reason: e.target.value, reasonError: false } : null)}
                                className={`w-full px-2 py-1.5 border rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${estimateEdit!.reasonError ? 'border-red-400' : 'border-slate-200'}`}
                              />
                              {estimateEdit!.reasonError && <p className="text-[10px] text-red-500">Reason required</p>}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <button type="submit" className="px-2.5 py-1 bg-brand-600 text-white text-[11px] font-semibold rounded-lg hover:bg-brand-700 transition-colors">Save</button>
                            <button type="button" onClick={() => setEstimateEdit(null)} className="px-2.5 py-1 border border-slate-200 text-[11px] rounded-lg hover:bg-white text-slate-600 transition-colors">Cancel</button>
                          </div>
                        </form>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
