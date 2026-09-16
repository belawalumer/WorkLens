'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

export default function SettingsClient({ leverageHours: init }: { leverageHours: number }) {
  const [leverageHours, setLeverageHours] = useState(String(init))
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(leverageHours)
    if (isNaN(v) || v <= 0 || v > 300) return
    setSaving(true)
    await supabase.from('app_settings').upsert({ key: 'leverage_hours', value: String(v) }, { onConflict: 'key' })
    setSaving(false)
    toast.success('Settings saved')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">App-wide configuration</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-semibold text-slate-700">Workload thresholds</h2>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Monthly leverage hours
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Minimum expected hours a developer should log per month. Used in Reports to flag underperforming months (shown as a utilization badge). e.g. 176h = 8h/day × 22 working days.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number" min="1" max="300" step="1"
                value={leverageHours}
                onChange={e => setLeverageHours(e.target.value)}
                className="w-28 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50"
              />
              <span className="text-sm text-slate-500">hours / month</span>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
