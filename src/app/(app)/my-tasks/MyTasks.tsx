'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types'
import { toast } from '@/lib/toast'

const TODAY = new Date().toISOString().split('T')[0]
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

function colLabel(date: string) {
  if (date === TODAY) return 'Today'
  if (date === YESTERDAY) return 'Yesterday'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function dateChipLabel(date: string) {
  if (date === TODAY) return 'Today'
  if (date === YESTERDAY) return 'Yesterday'
  if (date === TOMORROW) return 'Tomorrow'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props { initialTasks: Task[]; initialProjects: { id: string; name: string }[]; userId: string }
interface EstimateEdit { taskId: string; originalHours: number; hours: string; reason: string; reasonError: boolean }

export default function MyTasks({ initialTasks, initialProjects, userId }: Props) {
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddSaving, setQuickAddSaving] = useState(false)
  const [estimateEdit, setEstimateEdit] = useState<EstimateEdit | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ taskId: string; title: string } | null>(null)
  const [dateEdit, setDateEdit] = useState<{ taskId: string; date: string } | null>(null)
  const [projectEdit, setProjectEdit] = useState<string | null>(null)
  const [projectEditPos, setProjectEditPos] = useState<{ top: number; left: number } | null>(null)
  const supabase = createClient()

  const { data: projects = initialProjects } = useSWR<{ id: string; name: string }[]>(
    'projects',
    async () => (await supabase.from('projects').select('id, name').order('name')).data ?? [],
    { fallbackData: initialProjects },
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
        mutateTasks(prev => (prev ?? []).map(t => {
          if (t.id !== (payload.new as Task).id) return t
          const updated = payload.new as Task
          // Realtime payloads are raw rows — no joins. Preserve the existing project object.
          return { ...updated, project: updated.project ?? t.project }
        }), false)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks', filter: `developer_id=eq.${userId}` }, payload => {
        mutateTasks(prev => (prev ?? []).filter(t => t.id !== (payload.old as Task).id), false)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openQuickAdd(date: string) {
    setQuickAddDate(date)
    setQuickAddTitle('')
  }

  async function submitQuickAdd(date: string) {
    const title = quickAddTitle.trim()
    if (!title) { setQuickAddDate(null); return }
    setQuickAddSaving(true)
    const tempTask: Task = {
      id: crypto.randomUUID(),
      developer_id: userId,
      project_id: null,
      title,
      estimated_hours: 1,
      completed: false,
      task_date: date,
      estimate_change_reason: null,
    }
    mutateTasks(prev => [tempTask, ...(prev ?? [])], false)
    setQuickAddDate(null)
    setQuickAddSaving(false)
    await supabase.from('tasks').insert({ developer_id: userId, title, estimated_hours: 1, task_date: date })
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

  function openProjectEdit(e: React.MouseEvent<HTMLButtonElement>, taskId: string) {
    if (projectEdit === taskId) {
      setProjectEdit(null); setProjectEditPos(null)
    } else {
      const r = e.currentTarget.getBoundingClientRect()
      setProjectEditPos({ top: r.bottom + 2, left: r.left })
      setProjectEdit(taskId)
    }
  }

  function closeProjectEdit() { setProjectEdit(null); setProjectEditPos(null) }

  async function saveProject(taskId: string, projectId: string | null) {
    const proj = projects.find(p => p.id === projectId) ?? null
    mutateTasks(prev => (prev ?? []).map(t => t.id === taskId ? { ...t, project_id: projectId, project: proj ?? undefined } : t), false)
    closeProjectEdit()
    await supabase.from('tasks').update({ project_id: projectId }).eq('id', taskId)
    mutateTasks()
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

  function openDateEdit(task: Task) {
    setEstimateEdit(null)
    setDateEdit({ taskId: task.id, date: task.task_date })
  }

  async function saveDate(taskId: string, newDate: string) {
    if (!newDate) { setDateEdit(null); return }
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.task_date === newDate) { setDateEdit(null); return }
    mutateTasks(prev => (prev ?? []).map(t => t.id === taskId ? { ...t, task_date: newDate } : t), false)
    setDateEdit(null)
    await supabase.from('tasks').update({ task_date: newDate }).eq('id', taskId)
    mutateTasks()
    toast.success('Task moved')
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

  return (
    <div className="page-enter flex flex-col h-full">
      {/* Project edit dropdown — rendered fixed to escape kanban overflow-x-auto clipping */}
      {projectEdit && projectEditPos && (() => {
        const editingTask = tasks.find(t => t.id === projectEdit)
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeProjectEdit} />
            <div className="fixed z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
              style={{ top: projectEditPos.top, left: projectEditPos.left }}>
              <button onClick={() => saveProject(projectEdit, null)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-50 ${!editingTask?.project_id ? 'text-brand-600 font-semibold bg-brand-50' : 'text-slate-500'}`}>
                No project
              </button>
              <div className="max-h-48 overflow-y-auto">
                {projects.map(p => (
                  <button key={p.id} onClick={() => saveProject(projectEdit, p.id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-50 ${editingTask?.project_id === p.id ? 'text-brand-600 font-semibold bg-brand-50' : 'text-slate-700'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="mb-5 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl px-5 pt-5 pb-4 shadow-lg shadow-brand-900/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-brand-200 text-[11px] font-semibold uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-2xl font-bold text-white leading-tight">My Tasks</h1>
          </div>
          <button onClick={() => openQuickAdd(TODAY)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-700 text-sm font-semibold rounded-xl hover:bg-brand-50 transition-colors shadow-sm shrink-0 mt-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add task
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="bg-white/20 border border-white/10 rounded-xl px-3 py-2.5">
            <p className="text-brand-100 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Planned</p>
            <p className="text-white text-xl font-bold leading-none">{fmt(totalToday)}<span className="text-brand-100 text-xs font-normal ml-0.5">h</span></p>
          </div>
          <div className="bg-emerald-400/30 border border-emerald-300/20 rounded-xl px-3 py-2.5">
            <p className="text-emerald-100 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Done</p>
            <p className="text-white text-xl font-bold leading-none">{fmt(doneToday)}<span className="text-emerald-100 text-xs font-normal ml-0.5">h</span></p>
          </div>
          <div className={`rounded-xl px-3 py-2.5 border ${freeToday <= 1 ? 'bg-orange-400/40 border-orange-300/20' : 'bg-amber-300/25 border-amber-200/20'}`}>
            <p className="text-amber-100 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Free</p>
            <p className="text-white text-xl font-bold leading-none">{fmt(freeToday)}<span className="text-amber-100 text-xs font-normal ml-0.5">h</span></p>
          </div>
        </div>

        {totalToday > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-brand-200 text-[10px] font-medium">Today&apos;s progress</p>
              <p className="text-brand-200 text-[10px] font-semibold">{Math.round((doneToday / totalToday) * 100)}%</p>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (doneToday / totalToday) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

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
                {dayTasks.length === 0 && quickAddDate !== date && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-slate-400 text-xs">No tasks yet</p>
                    <button onClick={() => openQuickAdd(date)}
                      className="mt-1.5 text-brand-600 text-xs font-semibold hover:text-brand-800">
                      + Add one
                    </button>
                  </div>
                )}
                {dayTasks.length > 0 && (
                  dayTasks.map(task => (
                    <div key={task.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-start gap-2.5 px-3 py-2.5">

                        {/* Checkbox */}
                        <button onClick={() => toggleDone(task)}
                          className={`w-4.5 h-4.5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-brand-400'
                          }`}>
                          {task.completed && <span className="text-[9px] font-bold">✓</span>}
                        </button>

                        {/* Title + project */}
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

                          {/* Project badge — opens fixed dropdown (see top of return) */}
                          <button
                            onClick={e => openProjectEdit(e, task.id)}
                            className="mt-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors border bg-brand-50 text-brand-600 border-brand-200 hover:bg-brand-100">
                            {task.project?.name ?? 'Add Project'}
                          </button>
                        </div>
                      </div>

                      {/* Footer: hours + date + delete */}
                      <div className="flex items-center justify-between px-3 pb-2 gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <button
                            onClick={() => estimateEdit?.taskId === task.id ? setEstimateEdit(null) : openEstimateEdit(task)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors shrink-0 ${
                              estimateEdit?.taskId === task.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-700'
                            }`}>
                            {fmt(task.estimated_hours)}h
                          </button>
                          {/* Date chip — click to move task to another day */}
                          {dateEdit?.taskId === task.id ? (
                            <input
                              autoFocus
                              type="date"
                              value={dateEdit!.date}
                              onChange={e => {
                                if (e.target.value && e.target.value !== task.task_date) saveDate(task.id, e.target.value)
                              }}
                              onBlur={() => setDateEdit(null)}
                              onKeyDown={e => { if (e.key === 'Escape') setDateEdit(null) }}
                              className="text-[11px] font-medium px-1.5 py-0.5 rounded-lg border border-brand-400 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400 w-28"
                            />
                          ) : (
                            <button
                              onClick={() => openDateEdit(task)}
                              disabled={task.completed}
                              title={task.completed ? 'Completed tasks are locked' : 'Move to another date'}
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors truncate ${
                                task.completed
                                  ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                  : 'bg-slate-50 text-slate-500 hover:bg-brand-50 hover:text-brand-700'
                              }`}>
                              📅 {dateChipLabel(task.task_date)}
                            </button>
                          )}
                        </div>
                        <button onClick={() => deleteTask(task.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>

                      {/* Estimate edit panel */}
                      {estimateEdit?.taskId === task.id && (
                        <form onSubmit={saveEstimate} className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2 rounded-b-xl overflow-hidden">
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

                {/* Inline quick-add form */}
                {quickAddDate === date ? (
                  <form onSubmit={e => { e.preventDefault(); submitQuickAdd(date) }}
                    className="flex items-center gap-1.5 pt-1">
                    <input
                      autoFocus
                      value={quickAddTitle}
                      onChange={e => setQuickAddTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setQuickAddDate(null)}
                      placeholder="Task title…"
                      className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button type="submit" disabled={quickAddSaving || !quickAddTitle.trim()}
                      className="px-2.5 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:bg-brand-700 transition-colors">
                      Add
                    </button>
                    <button type="button" onClick={() => setQuickAddDate(null)}
                      className="px-2 py-1.5 border border-slate-200 text-slate-400 text-xs rounded-lg hover:bg-slate-50 transition-colors">
                      ✕
                    </button>
                  </form>
                ) : (
                  <button onClick={() => openQuickAdd(date)}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-400 hover:text-brand-600 hover:bg-white/60 rounded-lg transition-colors">
                    + Add task
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
