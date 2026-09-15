'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types'

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

const DAY_LABEL = (date: string) =>
  date === TODAY
    ? 'Today'
    : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

// Show integer when whole, one decimal otherwise
const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

interface Props {
  initialTasks: Task[]
  userId: string
}

interface EstimateEdit {
  taskId: string
  originalHours: number
  hours: string
  reason: string
  reasonError: boolean
}

export default function MyTasks({ initialTasks, userId }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [view, setView] = useState<'today' | 'week'>('today')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', estimated_hours: '1', task_date: TODAY })
  const [saving, setSaving] = useState(false)
  const [estimateEdit, setEstimateEdit] = useState<EstimateEdit | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ taskId: string; title: string } | null>(null)
  const [activeDay, setActiveDay] = useState(TODAY)
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
    const date = view === 'today' ? TODAY : activeDay
    await supabase.from('tasks').insert({
      developer_id: userId,
      title: form.title.trim(),
      estimated_hours: parseFloat(form.estimated_hours) || 1,
      task_date: date,
    })
    setForm({ title: '', estimated_hours: '1', task_date: TODAY })
    setAdding(false)
    setSaving(false)
  }

  async function toggleDone(task: Task) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  async function saveTitleEdit(taskId: string, newTitle: string) {
    const trimmed = newTitle.trim()
    if (!trimmed) { setEditingTitle(null); return }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: trimmed } : t))
    setEditingTitle(null)
    await supabase.from('tasks').update({ title: trimmed }).eq('id', taskId)
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
    setTasks(prev => prev.map(t => t.id === estimateEdit!.taskId ? { ...t, ...update } : t))
    await supabase.from('tasks').update(update).eq('id', estimateEdit.taskId)
    setEstimateEdit(null)
  }

  const todayTasks = tasks.filter(t => t.task_date === TODAY)
  const totalToday = todayTasks.reduce((s, t) => s + t.estimated_hours, 0)
  const doneToday = todayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)
  const freeToday = Math.max(0, 8 - totalToday)

  const displayDate = view === 'today' ? TODAY : activeDay

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors bg-slate-50'

  return (
    <div className="max-w-2xl mx-auto page-enter">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden text-sm shadow-sm">
              {(['today', 'week'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 font-medium transition-colors ${view === v ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                  {v === 'today' ? 'Today' : 'This Week'}
                </button>
              ))}
            </div>
            <button onClick={() => setAdding(a => !a)}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200">
              <span>+</span>
              <span className="hidden sm:inline">Add task</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* ── Week day tabs ─────────────────────────────────────── */}
      {view === 'week' && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {WEEKDAYS.map(date => {
            const count = tasks.filter(t => t.task_date === date).length
            const isActive = activeDay === date
            const isToday = date === TODAY
            return (
              <button key={date} onClick={() => setActiveDay(date)}
                className={`flex-1 min-w-[72px] px-3 py-2 rounded-xl text-center text-xs transition-colors ${
                  isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-200' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'
                }`}>
                <div className="font-semibold">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-[10px] mt-0.5 ${isActive ? 'text-brand-200' : isToday ? 'text-brand-600 font-semibold' : 'text-slate-400'}`}>
                  {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </div>
                {count > 0 && (
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full mx-auto ${isActive ? 'bg-brand-300' : 'bg-brand-400'}`} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Add task form ─────────────────────────────────────── */}
      {adding && (
        <form onSubmit={addTask} className="bg-white border border-brand-200 rounded-2xl p-4 mb-4 space-y-3 shadow-sm">
          <input autoFocus type="text" placeholder="What needs to be done?"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className={inputCls} />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 shrink-0">⏱</span>
              <input type="number" min="0.5" max="24" step="0.5" value={form.estimated_hours}
                onChange={e => setForm(f => ({ ...f, estimated_hours: e.target.value }))}
                className="w-14 text-sm focus:outline-none bg-transparent" />
              <span className="text-xs text-slate-500">h</span>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
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

      {/* ── Task list ─────────────────────────────────────────── */}
      {(view === 'today' ? [TODAY] : [displayDate]).map(date => {
        const dayTasks = tasks.filter(t => t.task_date === date)
        const dayHours = dayTasks.reduce((s, t) => s + t.estimated_hours, 0)
        const doneHours = dayTasks.filter(t => t.completed).reduce((s, t) => s + t.estimated_hours, 0)

        return (
          <div key={date}>
            {view === 'week' && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-700">{DAY_LABEL(date)}</h2>
                {dayHours > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{fmt(doneHours)}h / {fmt(dayHours)}h</span>
                    <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, (doneHours / dayHours) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {dayTasks.length === 0 ? (
              <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-400 text-sm font-medium">No tasks {view === 'today' ? 'for today' : 'this day'}</p>
                <button onClick={() => setAdding(true)}
                  className="mt-2 text-brand-600 text-sm font-semibold hover:text-brand-800">
                  + Add one →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <div key={task.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      {/* Checkbox */}
                      <button onClick={() => toggleDone(task)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          task.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-slate-300 hover:border-brand-400'
                        }`}>
                        {task.completed && <span className="text-[10px] font-bold">✓</span>}
                      </button>

                      {/* Title — click to edit */}
                      <div className="flex-1 min-w-0">
                        {editingTitle?.taskId === task.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingTitle.title}
                            onChange={e => setEditingTitle(p => p ? { ...p, title: e.target.value } : null)}
                            onBlur={() => saveTitleEdit(task.id, editingTitle.title)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveTitleEdit(task.id, editingTitle.title) }
                              if (e.key === 'Escape') setEditingTitle(null)
                            }}
                            className="w-full text-sm font-medium text-slate-800 bg-transparent border-b border-brand-400 focus:outline-none pb-0.5"
                          />
                        ) : (
                          <p
                            onClick={() => !task.completed && setEditingTitle({ taskId: task.id, title: task.title })}
                            className={`text-sm font-medium leading-snug ${
                              task.completed
                                ? 'line-through text-slate-400 cursor-default'
                                : 'text-slate-800 cursor-text hover:text-brand-700'
                            }`}
                          >
                            {task.title}
                          </p>
                        )}
                        {task.estimate_change_reason && (
                          <span className="text-[11px] text-amber-600 mt-0.5 block">✏️ {task.estimate_change_reason}</span>
                        )}
                      </div>

                      {/* Hours button → opens estimate edit */}
                      <button
                        onClick={() => estimateEdit?.taskId === task.id ? setEstimateEdit(null) : openEstimateEdit(task)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                          estimateEdit?.taskId === task.id
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                        }`}>
                        {fmt(task.estimated_hours)}h
                      </button>

                      {/* Delete */}
                      <button onClick={() => deleteTask(task.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors shrink-0 px-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>

                    {/* Estimate edit panel */}
                    {estimateEdit?.taskId === task.id && (
                      <form onSubmit={saveEstimate} className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-600 shrink-0">New estimate</label>
                          <input autoFocus type="number" min="0.5" max="24" step="0.5"
                            value={estimateEdit.hours}
                            onChange={e => setEstimateEdit(p => p ? { ...p, hours: e.target.value, reasonError: false } : null)}
                            className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                          <span className="text-xs text-slate-400">hours</span>
                        </div>
                        {parseFloat(estimateEdit.hours) !== estimateEdit.originalHours && (
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">
                              Reason for change <span className="text-red-500">*</span>
                            </label>
                            <textarea rows={2}
                              placeholder="Why are you changing the estimate?"
                              value={estimateEdit.reason}
                              onChange={e => setEstimateEdit(p => p ? { ...p, reason: e.target.value, reasonError: false } : null)}
                              className={`w-full px-2.5 py-1.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white ${estimateEdit.reasonError ? 'border-red-400' : 'border-slate-200'}`}
                            />
                            {estimateEdit.reasonError && <p className="text-xs text-red-500 mt-0.5">Reason is required when changing an estimate.</p>}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition-colors">Save</button>
                          <button type="button" onClick={() => setEstimateEdit(null)} className="px-3 py-1.5 border border-slate-200 text-xs rounded-lg hover:bg-white text-slate-600 transition-colors">Cancel</button>
                        </div>
                      </form>
                    )}
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
