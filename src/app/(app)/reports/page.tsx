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

  const [{ data: profiles }, { data: tasks }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, user_status').order('full_name'),
    supabase.from('tasks')
      .select('*, project:projects(id, name)')
      .gte('task_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('task_date', { ascending: false }),
  ])

  return <ReportsClient profiles={profiles ?? []} tasks={tasks ?? []} />
}
