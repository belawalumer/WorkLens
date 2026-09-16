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

  const [{ data: holidays }, { data: leaves }, { data: profiles }] = await Promise.all([
    supabase.from('public_holidays').select('id, holiday_date, name').order('holiday_date', { ascending: false }),
    supabase.from('leave_records').select('id, developer_id, leave_date, leave_type, note').order('leave_date', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  return (
    <SettingsClient
      initialHolidays={holidays ?? []}
      initialLeaves={leaves ?? []}
      developers={profiles ?? []}
    />
  )
}
