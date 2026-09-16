'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

interface Holiday { id: string; holiday_date: string; name: string }

const TODAY = new Date().toISOString().split('T')[0]

const inputCls = 'px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50 transition-colors'

export default function SettingsClient({
  leverageHours: init,
  initialHolidays,
}: {
  leverageHours: number
  initialHolidays: Holiday[]
}) {
  const [leverageHours, setLeverageHours] = useState(String(init))
  const [saving, setSaving] = useState(false)
  const [newHoliday, setNewHoliday] = useState({ date: TODAY, name: '' })
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  // ── Leverage hours ────────────────────────────────────────────────
  async function saveLeverage(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(leverageHours)
    if (isNaN(v) || v <= 0 || v > 300) return
    setSaving(true)
    await supabase.from('app_settings').upsert({ key: 'leverage_hours', value: String(v) }, { onConflict: 'key' })
    setSaving(false)
    toast.success('Settings saved')
  }

  // ── Holidays SWR ─────────────────────────────────────────────────
  const { data: holidays = initialHolidays, mutate } = useSWR<Holiday[]>(
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
    setAdding(true)
    const { data, error } = await supabase
      .from('public_holidays')
      .insert({ holiday_date: newHoliday.date, name: newHoliday.name.trim() })
      .select('id, holiday_date, name')
      .single()
    setAdding(false)
    if (error) { toast.error('Failed to add holiday'); return }
    mutate(prev => [data, ...(prev ?? [])].sort((a, b) => b.holiday_date.localeCompare(a.holiday_date)), false)
    setNewHoliday({ date: TODAY, name: '' })
    toast.success('Holiday added')
  }

  async function deleteHoliday(id: string) {
    mutate(prev => (prev ?? []).filter(h => h.id !== id), false)
    await supabase.from('public_holidays').delete().eq('id', id)
    mutate()
    toast.success('Holiday removed')
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isPast = (d: string) => d < TODAY
  const isToday = (d: string) => d === TODAY

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">App-wide configuration</p>
      </div>

      {/* ── Leverage hours ──────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-semibold text-slate-700">Workload thresholds</h2>

        <form onSubmit={saveLeverage} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Monthly leverage hours</label>
            <p className="text-xs text-slate-500 mb-2">
              Minimum expected hours a developer should log per month. Used in Reports to flag underperforming months. e.g. 176h = 8h/day × 22 working days.
            </p>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="300" step="1"
                value={leverageHours} onChange={e => setLeverageHours(e.target.value)}
                className={`w-28 ${inputCls}`} />
              <span className="text-sm text-slate-500">hours / month</span>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
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

        {/* Add form */}
        <form onSubmit={addHoliday} className="flex flex-col sm:flex-row gap-2">
          <input type="date" value={newHoliday.date} onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))}
            className={`${inputCls} w-full sm:w-44`} />
          <input type="text" placeholder="Holiday name (e.g. Eid ul-Fitr)" value={newHoliday.name}
            onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))}
            className={`${inputCls} flex-1`} />
          <button type="submit" disabled={adding || !newHoliday.name.trim()}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0">
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </form>

        {/* Holiday list */}
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
                    <p className={`text-sm font-semibold ${isPast(h.holiday_date) ? 'text-slate-400' : 'text-slate-800'}`}>
                      {h.name}
                    </p>
                    {isToday(h.holiday_date) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-wide">Today</span>
                    )}
                    {isPast(h.holiday_date) && !isToday(h.holiday_date) && (
                      <span className="text-[10px] text-slate-400 font-medium">Past</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isPast(h.holiday_date) ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fmtDate(h.holiday_date)}
                  </p>
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
    </div>
  )
}
