import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'super_admin') redirect('/')

  const [{ data: settings }, { data: holidays }] = await Promise.all([
    supabase.from('app_settings').select('key, value'),
    supabase.from('public_holidays').select('id, holiday_date, name').order('holiday_date', { ascending: false }),
  ])

  const map = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

  return (
    <SettingsClient
      leverageHours={parseFloat(map['leverage_hours'] ?? '176')}
      initialHolidays={holidays ?? []}
    />
  )
}
