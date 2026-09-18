'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types'
import { toast } from '@/lib/toast'
import DatePicker from '@/components/DatePicker'

const TODAY = new Date().toISOString().split('T')[0]
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()
const WEEK_START = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); return d.toISOString().split('T')[0] })()

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

function colLabel(date: string) {
  if (date === TODAY) return 'Today'
  if (date === YESTERDAY) return 'Yesterday'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function dateChipLabel(date: string | null) {
  if (!date) return 'Backlog'
  if (date === TODAY) return 'Today'
  if (date === YESTERDAY) return 'Yesterday'
  if (date === TOMORROW) return 'Tomorrow'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props { initialTasks: Task[]; initialProjects: { id: string; name: string }[]; userId: string }
interface EstimateEdit { taskId: string; originalHours: number; hours: string; reason: string; reasonError: boolean }

export default function MyTasks({ initialTasks, initialProjects, userId }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', estimated_hours: '1', task_date: TODAY, project_id: '', inBacklog: false })
  const [saving, setSaving] = useState(false)
  const [projOpen, setProjOpen] = useState(false)
  const [projSearch, setProjSearch] = useState('')
  const [estimateEdit, setEstimateEdit] = useState<EstimateEdit | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ taskId: string; title: string } | null>(null)
  const [dateEdit, setDateEdit] = useState<{ taskId: string; date: string | null } | null>(null)
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
      .or(`task_date.gte.${WEEK_START},task_date.is.null`)
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

  function openModal(date?: string, backlog = false) {
    setForm(f => ({ ...f, task_date: date ?? TODAY, title: '', project_id: '', inBacklog: backlog }))
    setProjOpen(false)
    setProjSearch('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setProjOpen(false)
    setProjSearch('')
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const projectId = form.project_id || null
    const proj = projects.find(p => p.id === projectId) ?? null
    const tempTask: Task = {
      id: crypto.randomUUID(),
      developer_id: userId,
      project_id: projectId,
      project: proj ?? undefined,
      title: form.title.trim(),
      estimated_hours: parseFloat(form.estimated_hours) || 1,
      completed: false,
      task_date: form.inBacklog ? null : form.task_date,
      estimate_change_reason: null,
    }
    mutateTasks(prev => [tempTask, ...(prev ?? [])], false)
    closeModal()
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

  async function saveDate(taskId: string, newDate: string | null) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.task_date === newDate) { setDateEdit(null); return }
    mutateTasks(prev => (prev ?? []).map(t => t.id === taskId ? { ...t, task_date: newDate } : t), false)
    setDateEdit(null)
    await supabase.from('tasks').update({ task_date: newDate }).eq('id', taskId)
    mutateTasks()
    toast.success(newDate ? 'Task moved' : 'Moved to backlog')
  }

  const todayTasks = tasks.filter(t => t.task_date === TODAY)
  const totalToday = todayTasks.reduce((s, t) => s + t.estimated_hours, 0)
  const doneToday  = todayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
  const freeToday  = Math.max(0, 8 - totalToday)

  const groupedDates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const t of tasks) {
      if (t.task_date && t.task_date >= WEEK_START) dateSet.add(t.task_date)
    }
    dateSet.add(TODAY)
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a))
  }, [tasks])

  const columns = useMemo(() => [
    { key: 'backlog', date: null as string | null, isBacklog: true },
    ...groupedDates.map(date => ({ key: date, date, isBacklog: false })),
  ], [groupedDates])

  const selectedProjName = projects.find(p => p.id === form.project_id)?.name

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
      <div className="mb-4 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-brand-200 text-[11px] font-semibold uppercase tracking-widest mb-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-2xl font-bold text-white leading-tight">My Tasks</h1>
          </div>
          <button onClick={() => openModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-brand-700 text-sm font-semibold rounded-xl hover:bg-brand-50 transition-colors shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add task
          </button>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Planned', value: totalToday, sub: `${todayTasks.length} tasks` },
          { label: 'Done',    value: doneToday,  sub: `${todayTasks.filter(t => t.completed).length} of ${todayTasks.length} tasks` },
          { label: 'Free',    value: freeToday,  sub: 'hours remaining' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-800 leading-none">
              {fmt(value)}<span className="text-sm font-normal text-slate-400 ml-0.5">h</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Board ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 flex-1 items-start">
        {columns.map(col => {
          const dayTasks = col.isBacklog
            ? tasks.filter(t => !t.task_date)
            : tasks.filter(t => t.task_date === col.date)
          const dayHours = dayTasks.reduce((s, t) => s + t.estimated_hours, 0)
          const doneHours = dayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
          const isToday = !col.isBacklog && col.date === TODAY

          return (
            <div key={col.key} className="flex-none w-72 flex flex-col">

              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-2xl border border-b-0 ${isToday ? 'bg-brand-600 border-brand-600' : 'bg-slate-100 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-700'}`}>
                    {col.isBacklog ? 'Backlog' : colLabel(col.date!)}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {dayTasks.length}
                  </span>
                </div>
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
              <div className={`flex flex-col gap-2 p-2 rounded-b-2xl border border-t-0 min-h-32 overflow-y-auto max-h-[490px] lg:max-h-[590px] ${isToday ? 'bg-brand-50/40 border-brand-200' : 'bg-slate-50 border-slate-200'}`}>
                {dayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-slate-400 text-xs">No tasks yet</p>
                    <button onClick={() => openModal(col.date ?? undefined, col.isBacklog)}
                      className="mt-1.5 text-brand-600 text-xs font-semibold hover:text-brand-800">
                      + Add one
                    </button>
                  </div>
                ) : (
                  dayTasks.map(task => (
                    <div key={task.id} className="bg-white border border-slate-200 rounded-xl">
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
                          {/* Date chip — click to move task to another day or backlog */}
                          {dateEdit?.taskId === task.id ? (
                            <DatePicker compact allowBacklog
                              value={dateEdit!.date ?? ''}
                              placeholder="Backlog"
                              onChange={v => { if (v !== (task.task_date ?? '')) saveDate(task.id, v); else setDateEdit(null) }}
                              onBacklog={() => { if (task.task_date !== null) saveDate(task.id, null); else setDateEdit(null) }} />
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
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Add Task Modal ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <form onSubmit={addTask} onClick={e => e.stopPropagation()} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Add Task</h2>
              <button type="button" onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Task</label>
                <input autoFocus type="text" placeholder="What needs to be done?" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50 transition-colors" />
              </div>
              <div className={`grid gap-3 ${form.inBacklog ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hours</label>
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus-within:ring-2 focus-within:ring-brand-400 transition-colors">
                    <input type="number" min="0.05" max="24" step="0.05" value={form.estimated_hours}
                      onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))}
                      className="w-full text-sm focus:outline-none bg-transparent" />
                    <span className="text-xs text-slate-400 shrink-0">h</span>
                  </div>
                </div>
                {!form.inBacklog && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Date</label>
                    <DatePicker value={form.task_date} onChange={v => setForm(f => ({ ...f, task_date: v }))} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.inBacklog}
                  onChange={e => {
                    const checked = e.target.checked
                    setForm(f => ({ ...f, inBacklog: checked, task_date: checked ? f.task_date : (f.task_date || TODAY) }))
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
                <span>
                  <span className="text-xs font-semibold text-slate-700">Save to backlog</span>
                  <span className="block text-[11px] text-slate-400">Date is optional — task stays in the Backlog column</span>
                </span>
              </label>
              {projects.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Project</label>
                  <div className="relative">
                    <button type="button" onClick={() => { setProjOpen(o => !o); setProjSearch('') }}
                      className="w-full flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                      <span className={selectedProjName ? 'text-slate-800 font-medium' : 'text-slate-400'}>{selectedProjName ?? 'No project'}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`text-slate-400 transition-transform ${projOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {projOpen && (
                      <>
                        <div className="fixed inset-0 z-0" onClick={() => setProjOpen(false)} />
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden">
                          <div className="p-2 border-b border-slate-100">
                            <input type="text" placeholder="Search projects…" value={projSearch} onChange={e => setProjSearch(e.target.value)} autoFocus
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50" />
                          </div>
                          <div className="max-h-44 overflow-y-auto">
                            <button type="button" onClick={() => { setForm(f => ({ ...f, project_id: '' })); setProjOpen(false) }}
                              className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 flex items-center gap-2 ${!form.project_id ? 'text-brand-600 font-semibold bg-brand-50/50' : 'text-slate-500'}`}>
                              <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0 flex items-center justify-center">{!form.project_id && <span className="w-2 h-2 rounded-full bg-brand-500 block" />}</span>
                              No project
                            </button>
                            {projects.filter(p => !projSearch || p.name.toLowerCase().includes(projSearch.toLowerCase())).map(p => (
                              <button type="button" key={p.id} onClick={() => { setForm(f => ({ ...f, project_id: p.id })); setProjOpen(false) }}
                                className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 flex items-center gap-2 ${form.project_id === p.id ? 'text-brand-600 font-semibold bg-brand-50/50' : 'text-slate-700'}`}>
                                <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0 flex items-center justify-center">{form.project_id === p.id && <span className="w-2 h-2 rounded-full bg-brand-500 block" />}</span>
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl overflow-hidden">
              <button type="submit" disabled={saving || !form.title.trim()}
                className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Add task'}
              </button>
              <button type="button" onClick={closeModal}
                className="px-5 py-2.5 border border-slate-200 text-sm rounded-xl hover:bg-white text-slate-600 transition-colors font-medium">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
