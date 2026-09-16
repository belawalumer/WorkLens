import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import RealtimeProvider from '@/components/RealtimeProvider'
import { Role, UserStatus } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, user_status, status_from, status_until')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        userName={profile?.full_name ?? user.email ?? ''}
        userRole={(profile?.role as Role) ?? 'developer'}
        userId={user.id}
        userStatus={(profile?.user_status as UserStatus) ?? 'active'}
        statusFrom={profile?.status_from ?? null}
        statusUntil={profile?.status_until ?? null}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <RealtimeProvider>{children}</RealtimeProvider>
      </main>
    </div>
  )
}
