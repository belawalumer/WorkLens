import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import RealtimeProvider from '@/components/RealtimeProvider'
import { Role, UserStatus, WorkloadStatus, getWorkloadStatus } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const [{ data: profile }, { data: todayTasks }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, user_status, status_from, status_until, assist_until').eq('id', user.id).single(),
    supabase.from('tasks').select('estimated_hours').eq('developer_id', user.id).eq('task_date', today),
  ])

  const todayHours = todayTasks?.reduce((s, t) => s + t.estimated_hours, 0) ?? 0
  const workloadStatus: WorkloadStatus = getWorkloadStatus(todayHours)

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <Navbar
        userName={profile?.full_name ?? user.email ?? ''}
        userRole={(profile?.role as Role) ?? 'developer'}
        userId={user.id}
        userStatus={(profile?.user_status as UserStatus) ?? 'active'}
        statusFrom={profile?.status_from ?? null}
        statusUntil={profile?.status_until ?? null}
        assistUntil={profile?.assist_until ?? null}
        workloadStatus={workloadStatus}
      />
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <RealtimeProvider>{children}</RealtimeProvider>
        </main>
      </div>
    </div>
  )
}
