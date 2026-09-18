import { createClient } from '@/lib/supabase/server'
import MyTasks from './MyTasks'
import { redirect } from 'next/navigation'
import { getPKTWeekStart } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const weekStart = getPKTWeekStart()

  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase.from('tasks').select('*, project:projects(id, name)')
      .eq('developer_id', user.id)
      .or(`task_date.gte.${weekStart},task_date.is.null`)
      .order('task_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name').order('name'),
  ])

  return <MyTasks initialTasks={tasks ?? []} initialProjects={projects ?? []} userId={user.id} />
}
