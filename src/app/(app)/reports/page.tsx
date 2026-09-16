import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'super_admin') redirect('/')

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

  const [{ data: profiles }, { data: tasks }, { data: holidays }, { data: leaves }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, user_status').order('full_name'),
    supabase.from('tasks').select('*, project:projects(id, name)').gte('task_date', sixMonthsAgoStr).order('task_date', { ascending: false }),
    supabase.from('public_holidays').select('holiday_date'),
    supabase.from('leave_records').select('developer_id, leave_date, leave_type').gte('leave_date', sixMonthsAgoStr),
  ])

  return (
    <ReportsClient
      profiles={profiles ?? []}
      tasks={tasks ?? []}
      holidayDates={(holidays ?? []).map(h => h.holiday_date as string)}
      leaveRecords={leaves ?? []}
    />
  )
}
