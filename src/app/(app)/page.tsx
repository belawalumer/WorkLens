import { createClient } from '@/lib/supabase/server'
import Dashboard from './Dashboard'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: profiles }, { data: roles }, { data: tasks }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('developer_roles').select('*, project:projects(id, name)'),
    supabase.from('tasks').select('*, project:projects(id, name)').gte('task_date', getWeekStart()),
  ])

  return (
    <Dashboard
      profiles={profiles ?? []}
      roles={roles ?? []}
      tasks={tasks ?? []}
      currentUserId={user?.id ?? ''}
      currentUserRole={(profile?.role as Role) ?? 'developer'}
    />
  )
}

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}
