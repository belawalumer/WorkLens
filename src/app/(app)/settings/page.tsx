import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['super_admin', 'hr_admin'].includes(me?.role ?? '')) redirect('/')

  const { data: holidays } = await supabase
    .from('public_holidays')
    .select('id, holiday_date, name')
    .order('holiday_date', { ascending: false })

  return <SettingsClient initialHolidays={holidays ?? []} />
}
