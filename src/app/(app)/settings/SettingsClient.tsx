'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import DatePicker from '@/components/DatePicker'

interface Holiday { id: string; holiday_date: string; name: string }
interface LeaveRecord { id: string; developer_id: string; leave_date: string; leave_type: string; note: string | null }
interface Dev { id: string; full_name: string }

const TODAY = new Date().toISOString().split('T')[0]
const LEAVE_LABELS: Record<string, string> = { full: 'Full day', half_morning: 'Half day', half_afternoon: 'Half day' }

const inputCls = 'px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50 transition-colors'

export default function SettingsClient({
  initialHolidays,
  initialLeaves,
  developers,
}: {
  initialHolidays: Holiday[]
  initialLeaves: LeaveRecord[]
  developers: Dev[]
}) {
  const [newHoliday, setNewHoliday] = useState({ date: TODAY, name: '' })
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [newLeave, setNewLeave] = useState({ developer_id: developers[0]?.id ?? '', date: TODAY, type: 'full', note: '' })
  const [addingLeave, setAddingLeave] = useState(false)
  const supabase = createClient()

  // ── Holidays ──────────────────────────────────────────────────────
  const { data: holidays = initialHolidays, mutate: mutateHolidays } = useSWR<Holiday[]>(
    'public-holidays',
    async () => {
      const { data } = await supabase.from('public_holidays').select('id, holiday_date, name').order('holiday_date', { ascending: false })
      return data ?? []
    },
    { fallbackData: initialHolidays },
  )

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!newHoliday.name.trim() || !newHoliday.date) return
    setAddingHoliday(true)
    const { data, error } = await supabase
      .from('public_holidays')
      .insert({ holiday_date: newHoliday.date, name: newHoliday.name.trim() })
      .select('id, holiday_date, name')
      .single()
    setAddingHoliday(false)
    if (error) { toast.error('Failed to add holiday'); return }
    mutateHolidays(prev => [data, ...(prev ?? [])].sort((a, b) => b.holiday_date.localeCompare(a.holiday_date)), false)
    setNewHoliday({ date: TODAY, name: '' })
    toast.success('Holiday added')
  }

  async function deleteHoliday(id: string) {
    mutateHolidays(prev => (prev ?? []).filter(h => h.id !== id), false)
    await supabase.from('public_holidays').delete().eq('id', id)
    mutateHolidays()
    toast.success('Holiday removed')
  }

  // ── Leave records ─────────────────────────────────────────────────
  const { data: leaves = initialLeaves, mutate: mutateLeaves } = useSWR<LeaveRecord[]>(
    'leave-records',
    async () => {
      const { data } = await supabase.from('leave_records').select('id, developer_id, leave_date, leave_type, note').order('leave_date', { ascending: false })
      return data ?? []
    },
    { fallbackData: initialLeaves },
  )

  async function addLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!newLeave.developer_id || !newLeave.date) return
    setAddingLeave(true)
    const { data, error } = await supabase
      .from('leave_records')
      .insert({ developer_id: newLeave.developer_id, leave_date: newLeave.date, leave_type: newLeave.type, note: newLeave.note.trim() || null })
      .select('id, developer_id, leave_date, leave_type, note')
      .single()
    setAddingLeave(false)
    if (error) { toast.error('Failed to add leave'); return }
    mutateLeaves(prev => [data, ...(prev ?? [])].sort((a, b) => b.leave_date.localeCompare(a.leave_date)), false)
    setNewLeave(p => ({ ...p, date: TODAY, note: '' }))
    toast.success('Leave recorded')
  }

  async function deleteLeave(id: string) {
    mutateLeaves(prev => (prev ?? []).filter(l => l.id !== id), false)
    await supabase.from('leave_records').delete().eq('id', id)
    mutateLeaves()
    toast.success('Leave removed')
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  const devName = (id: string) => developers.find(d => d.id === id)?.full_name ?? 'Unknown'
  const isPast = (d: string) => d < TODAY
  const isToday = (d: string) => d === TODAY

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">App-wide configuration</p>
      </div>

      {/* ── Public holidays ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Public Holidays</h2>
            <p className="text-xs text-slate-500 mt-0.5">Holidays suppress the "no tasks" alert on Dashboard for everyone.</p>
          </div>
          <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-100">
            {holidays.filter(h => h.holiday_date >= TODAY).length} upcoming
          </span>
        </div>

        <form onSubmit={addHoliday} className="flex flex-col sm:flex-row gap-2">
          <DatePicker value={newHoliday.date} onChange={v => setNewHoliday(p => ({ ...p, date: v }))}
            className="w-full sm:w-44" />
          <input type="text" placeholder="Holiday name (e.g. Eid ul-Fitr)" value={newHoliday.name}
            onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
            className={`${inputCls} flex-1`} />
          <button type="submit" disabled={addingHoliday || !newHoliday.name.trim()}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0">
            {addingHoliday ? 'Adding…' : '+ Add'}
          </button>
        </form>

        {holidays.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No holidays added yet
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {holidays.map(h => (
              <div key={h.id} className={`flex items-center gap-3 px-4 py-3 ${isPast(h.holiday_date) ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${isPast(h.holiday_date) ? 'text-slate-400' : 'text-slate-800'}`}>{h.name}</p>
                    {isToday(h.holiday_date) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-wide">Today</span>
                    )}
                    {isPast(h.holiday_date) && !isToday(h.holiday_date) && (
                      <span className="text-[10px] text-slate-400 font-medium">Past</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isPast(h.holiday_date) ? 'text-slate-400' : 'text-slate-500'}`}>{fmtDate(h.holiday_date)}</p>
                </div>
                <button onClick={() => deleteHoliday(h.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Leave records ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Developer Leaves</h2>
          <p className="text-xs text-slate-500 mt-0.5">Leave days are deducted from each developer's monthly expected hours in Reports.</p>
        </div>

        <form onSubmit={addLeave} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <select value={newLeave.developer_id} onChange={e => setNewLeave(p => ({ ...p, developer_id: e.target.value }))}
            className={inputCls}>
            {developers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
          <div className="flex gap-2">
            <DatePicker value={newLeave.date} onChange={v => setNewLeave(p => ({ ...p, date: v }))}
              className="flex-1" />
            <select value={newLeave.type} onChange={e => setNewLeave(p => ({ ...p, type: e.target.value }))}
              className={inputCls}>
              <option value="full">Full day</option>
              <option value="half_morning">Half day</option>
            </select>
          </div>
          <button type="submit" disabled={addingLeave || !newLeave.developer_id}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0">
            {addingLeave ? 'Adding…' : '+ Add'}
          </button>
        </form>

        {leaves.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No leave records yet
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {leaves.map(l => (
              <div key={l.id} className={`flex items-center gap-3 px-4 py-3 ${isPast(l.leave_date) ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${isPast(l.leave_date) ? 'text-slate-400' : 'text-slate-800'}`}>
                      {devName(l.developer_id)}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      l.leave_type === 'full'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {LEAVE_LABELS[l.leave_type] ?? l.leave_type}
                    </span>
                    {isToday(l.leave_date) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-wide">Today</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isPast(l.leave_date) ? 'text-slate-400' : 'text-slate-500'}`}>{fmtDate(l.leave_date)}</p>
                </div>
                <button onClick={() => deleteLeave(l.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
