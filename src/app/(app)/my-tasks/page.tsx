import { createClient } from '@/lib/supabase/server'
import MyTasks from './MyTasks'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, project:projects(id, name)')
    .eq('developer_id', user.id)
    .order('task_date', { ascending: false })
    .order('created_at', { ascending: false })

  return <MyTasks initialTasks={tasks ?? []} userId={user.id} />
}
