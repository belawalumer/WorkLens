import { createClient } from '@/lib/supabase/server'
import Dashboard from './Dashboard'
import { Role } from '@/types'
import { getPKTDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = getPKTDate()

  const [{ data: profile }, { data: profiles }, { data: roles }, { data: tasks }, { data: todayHoliday }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('developer_roles').select('*, project:projects(id, name)'),
    supabase.from('tasks').select('*, project:projects(id, name)').eq('task_date', today),
    supabase.from('public_holidays').select('name').eq('holiday_date', today).maybeSingle(),
  ])

  return (
    <Dashboard
      profiles={profiles ?? []}
      roles={roles ?? []}
      tasks={tasks ?? []}
      currentUserId={user?.id ?? ''}
      currentUserRole={(profile?.role as Role) ?? 'developer'}
      todayHoliday={todayHoliday?.name ?? null}
    />
  )
}
