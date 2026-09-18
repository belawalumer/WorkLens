import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'
import { isDevRole } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if (!me) redirect('/')

  const role = me.role as import('@/types').Role
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

  const [{ data: allProfiles }, { data: tasks }, { data: holidays }, leavesResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, user_status').order('full_name'),
    supabase.from('tasks').select('*, project:projects(id, name)').gte('task_date', sixMonthsAgoStr).order('task_date', { ascending: false }),
    supabase.from('public_holidays').select('holiday_date'),
    supabase.from('leave_records').select('developer_id, leave_date, leave_type').gte('leave_date', sixMonthsAgoStr),
  ])

  if (leavesResult.error) {
    console.error('[reports] leave_records query failed:', leavesResult.error.message)
  }
  const leaves = leavesResult.data

  const profiles = (allProfiles ?? []).filter(p => {
    if (isDevRole(role)) return p.id === me.id
    if (role === 'hr_admin') return p.role !== 'super_admin'
    return true // super_admin sees all
  })

  return (
    <ReportsClient
      profiles={profiles}
      tasks={tasks ?? []}
      holidayDates={(holidays ?? []).map(h => h.holiday_date as string)}
      leaveRecords={leaves ?? []}
    />
  )
}
